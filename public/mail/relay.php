<?php
/**
 * KashPoint mail relay.
 *
 * The API runs on Render, whose free instances cannot open the mail ports
 * (25, 465, 587). This file runs on the web host that also holds the
 * kashpoint.co.za mailboxes, so the API hands it a message over HTTPS and it
 * talks SMTP to the mail server from here.
 *
 * It keeps no secrets. Every call carries the mailbox's own login, which the
 * mail server checks; without the mailbox password the relay sends nothing.
 * Only kashpoint.co.za mail servers can be addressed, so it cannot be used to
 * reach anything else.
 */
declare(strict_types=1);

header('Content-Type: application/json');
header('Cache-Control: no-store');
set_time_limit(60);

function reply(int $status, array $body): void
{
    http_response_code($status);
    echo json_encode($body);
    exit;
}

class SmtpError extends RuntimeException
{
    public int $smtpCode;

    public function __construct(int $code, string $message)
    {
        parent::__construct($message);
        $this->smtpCode = $code;
    }
}

class Smtp
{
    /** @var resource */
    private $fp;

    public function __construct(string $host, int $port)
    {
        $ctx = stream_context_create(['ssl' => ['verify_peer' => true, 'verify_peer_name' => true]]);
        $scheme = $port === 465 ? 'ssl://' : 'tcp://';
        $fp = @stream_socket_client($scheme . $host . ':' . $port, $errno, $errstr, 20, STREAM_CLIENT_CONNECT, $ctx);
        if ($fp === false) {
            throw new RuntimeException('Could not reach the mail server: ' . $errstr);
        }
        stream_set_timeout($fp, 20);
        $this->fp = $fp;
    }

    /** @return array{0:int,1:string} */
    public function read(): array
    {
        $code = 0;
        $lines = [];
        while (($line = fgets($this->fp, 2048)) !== false) {
            $lines[] = rtrim($line);
            if (preg_match('/^(\d{3})([ -])/', $line, $m)) {
                $code = (int) $m[1];
                if ($m[2] === ' ') {
                    break;
                }
            } else {
                break;
            }
        }
        return [$code, implode("\n", $lines)];
    }

    public function cmd(string $command, array $expected): string
    {
        fwrite($this->fp, $command . "\r\n");
        [$code, $msg] = $this->read();
        if (!in_array($code, $expected, true)) {
            throw new SmtpError($code, $msg);
        }
        return $msg;
    }

    public function write(string $data): void
    {
        fwrite($this->fp, $data);
    }

    public function startTls(): void
    {
        if (!stream_socket_enable_crypto($this->fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
            throw new RuntimeException('STARTTLS failed');
        }
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    reply(200, ['ok' => true, 'service' => 'kashpoint-mail-relay']);
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    reply(405, ['ok' => false, 'error' => 'POST only']);
}

$raw = file_get_contents('php://input', false, null, 0, 400000);
if ($raw === false || strlen($raw) >= 400000) {
    reply(413, ['ok' => false, 'error' => 'Message too large']);
}
$in = json_decode($raw, true);
if (!is_array($in)) {
    reply(400, ['ok' => false, 'error' => 'Body must be JSON']);
}

$user = trim((string) ($in['user'] ?? ''));
$password = (string) ($in['password'] ?? '');
$to = trim((string) ($in['to'] ?? ''));
$subject = trim((string) ($in['subject'] ?? ''));
$html = (string) ($in['html'] ?? '');
$text = (string) ($in['text'] ?? '');
$fromName = trim((string) ($in['from_name'] ?? 'KashPoint'));
$replyTo = trim((string) ($in['reply_to'] ?? ''));
$host = strtolower(trim((string) ($in['host'] ?? 'mail.kashpoint.co.za')));
$port = (int) ($in['port'] ?? 465);

if (!filter_var($user, FILTER_VALIDATE_EMAIL) || $password === '') {
    reply(400, ['ok' => false, 'error' => 'Mailbox login missing']);
}
if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
    reply(400, ['ok' => false, 'error' => 'Invalid recipient address']);
}
if ($replyTo !== '' && !filter_var($replyTo, FILTER_VALIDATE_EMAIL)) {
    reply(400, ['ok' => false, 'error' => 'Invalid reply-to address']);
}
if ($subject === '' || ($html === '' && $text === '')) {
    reply(400, ['ok' => false, 'error' => 'Subject and body are required']);
}
if (!preg_match('/^[a-z0-9.-]+$/', $host) || !preg_match('/(^|\.)kashpoint\.co\.za$/', $host)) {
    reply(400, ['ok' => false, 'error' => 'Only kashpoint.co.za mail servers can be used']);
}
if (!in_array($port, [465, 587], true)) {
    reply(400, ['ok' => false, 'error' => 'Port must be 465 or 587']);
}

$encodeHeader = static function (string $value): string {
    return '=?UTF-8?B?' . base64_encode($value) . '?=';
};

$domain = substr(strrchr($user, '@'), 1);
$boundary = 'kp-' . bin2hex(random_bytes(12));
$messageId = '<' . bin2hex(random_bytes(10)) . '.' . time() . '@' . $domain . '>';
$textPart = $text !== '' ? $text : trim(strip_tags(preg_replace('/<br\s*\/?>|<\/(p|div|tr|h[1-6]|li)>/i', "\n", $html)));
$htmlPart = $html !== '' ? $html : nl2br(htmlspecialchars($textPart, ENT_QUOTES, 'UTF-8'));

$headers = [
    'Date: ' . date('r'),
    'From: ' . $encodeHeader($fromName) . ' <' . $user . '>',
    'To: <' . $to . '>',
    'Subject: ' . $encodeHeader($subject),
    'Message-ID: ' . $messageId,
    'MIME-Version: 1.0',
    'Content-Type: multipart/alternative; boundary="' . $boundary . '"',
    'X-Mailer: KashPoint relay',
];
if ($replyTo !== '') {
    $headers[] = 'Reply-To: <' . $replyTo . '>';
}
$body = '--' . $boundary . "\r\n"
    . "Content-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
    . chunk_split(base64_encode($textPart), 76, "\r\n")
    . '--' . $boundary . "\r\n"
    . "Content-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
    . chunk_split(base64_encode($htmlPart), 76, "\r\n")
    . '--' . $boundary . "--\r\n";
$data = implode("\r\n", $headers) . "\r\n\r\n" . $body;
// A line consisting of a single dot ends the message; stuff any leading dots.
$data = preg_replace('/^\./m', '..', $data);

try {
    $smtp = new Smtp($host, $port);
    [$code] = $smtp->read();
    if ($code !== 220) {
        throw new RuntimeException('Mail server did not greet (' . $code . ')');
    }
    $smtp->cmd('EHLO app.kashpoint.co.za', [250]);
    if ($port === 587) {
        $smtp->cmd('STARTTLS', [220]);
        $smtp->startTls();
        $smtp->cmd('EHLO app.kashpoint.co.za', [250]);
    }
    try {
        $smtp->cmd('AUTH LOGIN', [334]);
        $smtp->cmd(base64_encode($user), [334]);
        $smtp->cmd(base64_encode($password), [235]);
    } catch (SmtpError $e) {
        reply(401, ['ok' => false, 'error' => 'Mailbox login failed: check SMTP_USER and SMTP_PASSWORD.']);
    }
    $smtp->cmd('MAIL FROM:<' . $user . '>', [250]);
    try {
        $smtp->cmd('RCPT TO:<' . $to . '>', [250, 251]);
    } catch (SmtpError $e) {
        reply(400, ['ok' => false, 'error' => 'The mail server refused the address ' . $to . '.']);
    }
    $smtp->cmd('DATA', [354]);
    $smtp->write($data . "\r\n.\r\n");
    [$code, $msg] = $smtp->read();
    if ($code !== 250) {
        throw new RuntimeException('Mail server rejected the message: ' . $msg);
    }
    try {
        $smtp->cmd('QUIT', [221]);
    } catch (Throwable $ignored) {
    }
    reply(200, ['ok' => true, 'message_id' => $messageId]);
} catch (Throwable $e) {
    reply(502, ['ok' => false, 'error' => 'Email could not be sent: ' . $e->getMessage()]);
}
