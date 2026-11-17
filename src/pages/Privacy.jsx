import { Card, CardContent } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { ArrowLeft, Shield } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Privacy() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-6 sm:py-12 px-4">
      <div className="max-w-3xl mx-auto w-full min-w-0">
        <div className="mb-8">
          <Link to="/auth">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
        </div>

        <Card>
          <CardContent className="p-4 sm:p-8 prose dark:prose-invert max-w-none">
            <div className="flex items-center gap-3 mb-6">
              <Shield className="w-8 h-8 text-green-600 flex-shrink-0" />
              <h1 className="text-2xl sm:text-3xl font-bold m-0 break-words">Privacy Policy</h1>
            </div>
            
            <p className="text-sm text-gray-500">
              Last updated: November 17, 2026 | Version 1.1
            </p>

            <p>
              KashPoint ("we", "us", "our") is committed to protecting your privacy. This Privacy 
              Policy explains how we collect, use, disclose, and safeguard your information when 
              you use our point-of-sale service.
            </p>

            <h2>1. Information We Collect</h2>
            
            <h3>1.1 Information You Provide</h3>
            <ul>
              <li><strong>Account Information:</strong> Name, email address, password, store name</li>
              <li><strong>Business Data:</strong> Products, sales records, customer information, employee data</li>
              <li><strong>Payment Information:</strong> Billing address, payment method (processed by Paystack)</li>
              <li><strong>Communications:</strong> Support requests, feedback</li>
            </ul>

            <h3>1.2 Information Collected Automatically</h3>
            <ul>
              <li><strong>Usage Data:</strong> Pages viewed, features used, time spent</li>
              <li><strong>Device Information:</strong> Browser type, operating system, device type</li>
              <li><strong>Log Data:</strong> IP address, access times, referring URLs</li>
              <li><strong>Cookies:</strong> Session cookies, preference cookies, analytics cookies</li>
            </ul>

            <h2>2. How We Use Your Information</h2>
            <ul>
              <li>To provide and maintain the Service</li>
              <li>To process transactions and send related notifications</li>
              <li>To send administrative information (updates, security alerts)</li>
              <li>To respond to your inquiries and provide support</li>
              <li>To improve our products and develop new features</li>
              <li>To detect and prevent fraud and abuse</li>
              <li>To comply with legal obligations</li>
              <li>To send marketing communications (with your consent)</li>
            </ul>

            <h2>3. How We Share Your Information</h2>
            <p>We do NOT sell your personal information. We may share data with:</p>
            <ul>
              <li><strong>Service Providers:</strong> Hosting, payment processing, analytics</li>
              <li><strong>Meta (Facebook):</strong> Only if you accept marketing cookies, the Meta Pixel tells Meta
                that someone visited kashpoint.co.za or signed up, so we can measure which of our adverts work.
                It never runs inside the till, and it never sends your products, sales or customers.</li>
              <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
              <li><strong>Business Transfers:</strong> In the event of a merger or acquisition</li>
            </ul>

            <h2>4. Data Security</h2>
            <p>We implement industry-standard security measures including:</p>
            <ul>
              <li>Encryption of data in transit (TLS) and at rest</li>
              <li>Regular security assessments and audits</li>
              <li>Access controls and authentication</li>
              <li>Employee security training</li>
            </ul>

            <h2>5. Data Retention</h2>
            <ul>
              <li>Account data: Retained while your account is active</li>
              <li>Business data: Retained for the duration of your subscription</li>
              <li>Log data: Retained for 12 months</li>
              <li>After account deletion: Data is permanently deleted within 30 days</li>
            </ul>

            <h2>6. Your Rights (POPIA / GDPR)</h2>
            <p>You have the right to:</p>
            <ul>
              <li><strong>Access:</strong> Request a copy of your personal data</li>
              <li><strong>Rectification:</strong> Correct inaccurate personal data</li>
              <li><strong>Erasure:</strong> Request deletion of your data ("right to be forgotten")</li>
              <li><strong>Portability:</strong> Export your data in a machine-readable format</li>
              <li><strong>Object:</strong> Object to processing for marketing purposes</li>
              <li><strong>Withdraw Consent:</strong> Withdraw consent at any time</li>
            </ul>
            <p>
              To exercise these rights, visit Settings → Privacy & Security or contact us at 
              support@kashpoint.co.za.
            </p>

            <h2>7. Cookies</h2>
            <p>We use cookies for:</p>
            <ul>
              <li><strong>Essential:</strong> Required for the site to function (always enabled)</li>
              <li><strong>Functional:</strong> Remember your preferences</li>
              <li><strong>Analytics:</strong> Understand how users interact with our site</li>
              <li><strong>Marketing:</strong> The Meta Pixel on kashpoint.co.za and our sign-up page, to measure
                our adverts (opt-in only: it loads only after you accept marketing cookies)</li>
            </ul>
            <p>You can manage cookie preferences through the cookie banner or browser settings.</p>

            <h2>8. International Transfers</h2>
            <p>
              Your data may be transferred to and processed in countries outside South Africa. 
              We ensure appropriate safeguards are in place for such transfers in compliance with 
              POPIA and other applicable laws.
            </p>

            <h2>9. Children's Privacy</h2>
            <p>
              Our Service is not intended for children under 18. We do not knowingly collect 
              personal information from children.
            </p>

            <h2>10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of significant 
              changes via email or through the Service. The "Last updated" date at the top indicates 
              when the policy was last revised.
            </p>

            <h2>11. Contact Us</h2>
            <p>
              For questions about this Privacy Policy or our data practices:
            </p>
            <ul>
              <li><strong>Email:</strong> support@kashpoint.co.za</li>
              <li><strong>Information Officer:</strong> Robel Berhanu, support@kashpoint.co.za</li>
              <li><strong>Address:</strong> Johannesburg, South Africa</li>
            </ul>

            <h2>12. Regulatory Authority</h2>
            <p>
              If you have concerns about our data practices, you may lodge a complaint with the 
              Information Regulator (South Africa) at inforeg.org.za.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
