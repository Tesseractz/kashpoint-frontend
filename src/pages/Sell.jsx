import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ProductsAPI, SalesAPI, ReturnsAPI, NotificationsAPI, CustomersAPI, ProfileAPI, BarcodeAPI } from "../api/client";
import BarcodeScanner from "../components/BarcodeScanner";
import ReceiptSlip from "../components/ReceiptSlip";
import { buildReceipt, receiptText, whatsappUrl } from "../lib/receipt";
import { beepSuccess, beepError } from "../lib/beep";
import { openExternalUrl, isCapacitorNative } from "../lib/platform";
import {
  getParkedSales,
  parkSale,
  removeParkedSale,
  resumeParkedCart,
  parkedSaleTotal,
} from "../lib/parkedSales";
import toast from "react-hot-toast";
import { Button } from "../components/ui/Button";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import {
  OFFLINE_SALES_KEY,
  PRODUCT_CACHE_KEY,
  getOfflineSales,
  setOfflineSales,
  getCachedProducts,
  setCachedProducts,
  syncAllOffline,
} from "../lib/offlineSync";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../components/ui/Card";
import {
  ShoppingCart,
  Package,
  Plus,
  Minus,
  Mail,
  X,
  Send,
  Search,
  CreditCard,
  Banknote,
  ChevronLeft,
  ChevronRight,
  Check,
  AlertCircle,
  ImageIcon,
  Trash2,
  RotateCcw,
  ArrowLeftRight,
  Tag,
  User,
  Gift,
  ScanLine,
  Printer,
  TrendingUp,
  PauseCircle,
  History,
  PlayCircle,
  Share2,
} from "lucide-react";

const PRODUCTS_PER_PAGE = 12;
const OFFLINE_QUEUE_KEY = OFFLINE_SALES_KEY;

export default function Sell() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  // Mode: 'sale' or 'return'
  const [mode, setMode] = useState("sale");

  // Cart state - array of { product, quantity }
  const [cart, setCart] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showCart, setShowCart] = useState(false);
  const isOnline = useOnlineStatus();
  const [offlineQueue, setOfflineQueue] = useState(() => getOfflineSales());
  const [isSyncing, setIsSyncing] = useState(false);
  const [cachedProducts, setCachedProductsState] = useState(() =>
    getCachedProducts()
  );

  // Payment state
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentAmount, setPaymentAmount] = useState("");

  // Return state
  const [returnReason, setReturnReason] = useState("");
  const [refundModal, setRefundModal] = useState({
    open: false,
    items: [],
    total: 0,
  });

  // Receipt modal state
  const [receiptModal, setReceiptModal] = useState({
    open: false,
    saleIds: [],
    receiptId: "",
    total: 0,
    items: [],
    paymentMethod: "cash",
    paymentAmount: 0,
    change: 0,
    offline: false,
    // Captured at the moment of sale: the cart's customer is cleared right after.
    customer: null,
    cashierName: null,
    createdAt: null,
  });
  const [receiptEmail, setReceiptEmail] = useState("");
  const [sendingReceipt, setSendingReceipt] = useState(false);

  // Customer for checkout
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);

  // Barcode scanning
  const [showScanner, setShowScanner] = useState(false);
  const searchInputRef = useRef(null);
  const lastScanRef = useRef({ code: "", at: 0 });

  // Parked (held) sales
  const [parkedSales, setParkedSalesState] = useState(() => getParkedSales());
  const [showParked, setShowParked] = useState(false);

  const productsQuery = useQuery({
    queryKey: ["products-for-sale"],
    queryFn: () => ProductsAPI.list({ page: 1, page_size: 1000 }),
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  // Fetch customers for search
  const customersQuery = useQuery({
    queryKey: ["customers-search", customerSearch],
    queryFn: () => CustomersAPI.list({ q: customerSearch || undefined }),
    enabled: showCustomerSearch,
    staleTime: 30000,
  });

  const profileQuery = useQuery({
    queryKey: ["profile"],
    queryFn: () => ProfileAPI.get(),
    staleTime: 60000,
  });

  // Today's sales — the "recent-sales" key is already invalidated after each
  // sale/sync, so these stats stay live for free.
  const salesQuery = useQuery({
    queryKey: ["recent-sales"],
    queryFn: () => SalesAPI.list(),
    staleTime: 60000,
    enabled: isOnline,
    refetchOnWindowFocus: false,
  });

  const todayStats = useMemo(() => {
    const rows = salesQuery.data;
    if (!Array.isArray(rows)) return null;
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    let count = 0;
    let revenue = 0;
    for (const s of rows) {
      const t = new Date(s.timestamp);
      if (Number.isNaN(t.getTime()) || t < dayStart) continue;
      const amount = Number(s.total_price) || 0;
      revenue += amount; // returns are negative rows → net revenue
      if (amount >= 0) count += 1;
    }
    return { count, revenue };
  }, [salesQuery.data]);

  useEffect(() => {
    if (productsQuery.data?.items?.length) {
      setCachedProductsState(productsQuery.data.items);
      setCachedProducts(productsQuery.data.items);
    }
  }, [productsQuery.data?.items]);

  const updateOfflineQueue = (queue) => {
    setOfflineQueue(queue);
    setOfflineSales(queue);
  };

  const syncOfflineSales = async (source = "auto") => {
    if (!isOnline || isSyncing || offlineQueue.length === 0) return;
    setIsSyncing(true);
    const result = await syncAllOffline({ ProductsAPI, SalesAPI });
    updateOfflineQueue(getOfflineSales());
    setIsSyncing(false);

    if (result.salesSynced > 0 || result.productsSynced > 0) {
      qc.invalidateQueries({ queryKey: ["products-for-sale"] });
      qc.invalidateQueries({ queryKey: ["recent-sales"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success(
        `Synced ${result.salesSynced} sale${
          result.salesSynced > 1 ? "s" : ""
        } and ${result.productsSynced} product change${
          result.productsSynced > 1 ? "s" : ""
        }`
      );
    }
  };

  useEffect(() => {
    if (isOnline && offlineQueue.length > 0) {
      syncOfflineSales("auto");
    }
  }, [isOnline, offlineQueue.length]);

  // Filter and paginate products
  const allProducts = productsQuery.data?.items || cachedProducts || [];
  const usingCachedProducts =
    !productsQuery.data?.items && cachedProducts && cachedProducts.length > 0;

  const filteredProducts = useMemo(() => {
    let products = allProducts;
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      products = products.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.sku?.toLowerCase().includes(query)
      );
    }
    
    return products;
  }, [allProducts, searchQuery]);

  const totalPages = Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE);

  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * PRODUCTS_PER_PAGE;
    return filteredProducts.slice(start, start + PRODUCTS_PER_PAGE);
  }, [filteredProducts, currentPage]);

  const handleSearchChange = (value) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  // Cart calculations
  const cartSubtotal = useMemo(() => {
    return cart.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0
    );
  }, [cart]);

  const cartTotal = cartSubtotal;

  const cartItemCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  const paymentAmountNum = parseFloat(paymentAmount) || 0;
  const change =
    paymentMethod === "cash" ? Math.max(0, paymentAmountNum - cartTotal) : 0;
  const canCompleteSale =
    cart.length > 0 &&
    (paymentMethod === "card" || paymentAmountNum >= cartTotal);

  // Select customer
  const handleSelectCustomer = (customer) => {
    setSelectedCustomer(customer);
    setShowCustomerSearch(false);
    setCustomerSearch("");
    toast.success(`Customer: ${customer.name}`);
  };

  // Clear customer
  const clearCustomer = () => setSelectedCustomer(null);

  // Cart functions
  const addToCart = (product) => {
    if (product.quantity === 0) return;

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        // Check if we can add more
        if (existing.quantity >= product.quantity) {
          toast.error(`Only ${product.quantity} in stock`);
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });

    if (!showCart && window.innerWidth < 1024) {
      // Show cart indicator on mobile
    }
  };

  const updateCartQuantity = (productId, newQuantity) => {
    setCart((prev) => {
      const item = prev.find((i) => i.product.id === productId);
      if (!item) return prev;

      if (newQuantity <= 0) {
        return prev.filter((i) => i.product.id !== productId);
      }

      if (newQuantity > item.product.quantity) {
        toast.error(`Only ${item.product.quantity} in stock`);
        return prev;
      }

      return prev.map((i) =>
        i.product.id === productId ? { ...i, quantity: newQuantity } : i
      );
    });
  };

  const removeFromCart = (productId) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setPaymentAmount("");
    setPaymentMethod("cash");
    setReturnReason("");
    setSelectedCustomer(null);
    setShowCustomerSearch(false);
    setCustomerSearch("");
  };

  const switchMode = (newMode) => {
    if (cart.length > 0) {
      if (!confirm(`Switching to ${newMode === 'sale' ? 'Sale' : 'Return'} mode will clear your current cart. Continue?`)) {
        return;
      }
    }
    clearCart();
    setMode(newMode);
  };

  // ---- Barcode scanning ----------------------------------------------------

  const handleScannedCode = useCallback(
    async (code) => {
      // Debounce duplicate reads of the same code (camera loops, double-triggers)
      const now = Date.now();
      if (lastScanRef.current.code === code && now - lastScanRef.current.at < 2500) return;
      lastScanRef.current = { code, at: now };

      // Local match first — instant and works offline
      const local = allProducts.find((p) => p.barcode === code || p.sku === code);
      if (local) {
        if (local.quantity === 0) {
          beepError();
          toast.error(`${local.name} is out of stock`);
          return;
        }
        beepSuccess();
        addToCart(local);
        toast.success(`Scanned: ${local.name}`);
        return;
      }

      if (!isOnline) {
        beepError();
        toast.error("Barcode not found in cached products");
        return;
      }

      try {
        const resp = await BarcodeAPI.lookup(code);
        const full = allProducts.find((p) => p.id === resp.product_id) || {
          id: resp.product_id,
          name: resp.name,
          price: resp.price,
          quantity: resp.quantity,
        };
        if (full.quantity === 0) {
          beepError();
          toast.error(`${full.name} is out of stock`);
          return;
        }
        beepSuccess();
        addToCart(full);
        toast.success(`Scanned: ${resp.name}`);
      } catch (e) {
        beepError();
        toast.error(
          e?.response?.status === 404
            ? `No product for barcode "${code}"`
            : "Barcode lookup failed"
        );
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allProducts, isOnline]
  );

  // Page-wide USB/bluetooth scanner-gun capture: guns "type" the code much
  // faster than a human (<60ms between keys) and finish with Enter. We only
  // hijack the burst when focus is free or in the product search box — typing
  // in other form fields (payment amount, customer search) is never touched.
  useEffect(() => {
    let buf = "";
    let last = 0;
    const isFormField = (el) =>
      el &&
      (el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA" ||
        el.tagName === "SELECT" ||
        el.isContentEditable);

    const onKeyDown = (e) => {
      if (showScanner || receiptModal.open || refundModal.open) return;
      const now = performance.now();
      if (now - last > 60) buf = "";
      last = now;

      if (e.key === "Enter") {
        if (buf.length >= 4) {
          const code = buf;
          buf = "";
          const el = document.activeElement;
          if (isFormField(el) && el !== searchInputRef.current) return;
          e.preventDefault();
          if (el === searchInputRef.current) {
            // The gun's keystrokes landed in the search box — clean them out.
            setSearchQuery("");
            setCurrentPage(1);
          }
          handleScannedCode(code);
        }
        return;
      }
      if (e.key.length === 1) buf += e.key;
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [showScanner, receiptModal.open, refundModal.open, handleScannedCode]);

  // ---- Parked (held) sales -------------------------------------------------

  const handleParkSale = () => {
    if (cart.length === 0 || mode !== "sale") return;
    const next = parkSale({
      cart,
      customer: selectedCustomer,
      paymentMethod,
    });
    setParkedSalesState(next);
    clearCart();
    setShowCart(false);
    toast.success("Sale parked — recall it any time");
  };

  const handleResumeParked = (entry) => {
    if (cart.length > 0 && !confirm("Resuming will replace the current cart. Continue?")) {
      return;
    }
    const { cart: restored, warnings } = resumeParkedCart(entry, allProducts);
    if (restored.length === 0) {
      toast.error("None of the parked items are still available");
      warnings.forEach((w) => toast(w, { icon: "⚠️" }));
      return;
    }
    setMode("sale");
    setCart(restored);
    setSelectedCustomer(entry.customer || null);
    setPaymentMethod(entry.paymentMethod || "cash");
    setPaymentAmount("");
    setParkedSalesState(removeParkedSale(entry.id));
    warnings.forEach((w) => toast(w, { icon: "⚠️" }));
    setShowParked(false);
    toast.success("Parked sale restored");
  };

  const handleDiscardParked = (id) => {
    if (!confirm("Discard this parked sale?")) return;
    setParkedSalesState(removeParkedSale(id));
  };

  // ---- Keyboard shortcuts ----------------------------------------------------
  // "/" focus search · F2 scan · F4 cash/card · F9 complete sale · Esc close

  useEffect(() => {
    const anyOverlayOpen =
      showScanner || showParked || receiptModal.open || refundModal.open;

    const onKey = (e) => {
      if (e.key === "Escape") {
        if (showScanner) setShowScanner(false);
        else if (showParked) setShowParked(false);
        else if (showCustomerSearch) setShowCustomerSearch(false);
        else if (showCart) setShowCart(false);
        return;
      }
      if (anyOverlayOpen) return;

      const el = document.activeElement;
      const typing =
        el &&
        (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);

      if (e.key === "/" && !typing) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      if (e.key === "F2") {
        e.preventDefault();
        setShowScanner(true);
        return;
      }
      if (e.key === "F4" && mode === "sale") {
        e.preventDefault();
        setPaymentMethod((m) => (m === "cash" ? "card" : "cash"));
        return;
      }
      if (e.key === "F9" && mode === "sale") {
        e.preventDefault();
        if (canCompleteSale && !isSubmitting) handleSell();
        return;
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    showScanner,
    showParked,
    receiptModal.open,
    refundModal.open,
    showCustomerSearch,
    showCart,
    mode,
    canCompleteSale,
    isSubmitting,
    cart,
    paymentAmount,
    paymentMethod,
  ]);

  // Handle return processing
  const handleReturn = async () => {
    if (isSubmitting || cart.length === 0) return;

    if (!isOnline) {
      toast.error("Returns require an internet connection");
      return;
    }

    setIsSubmitting(true);

    try {
      const returnPromises = cart.map((item) =>
        ReturnsAPI.create({
          product_id: item.product.id,
          quantity_returned: item.quantity,
          reason: returnReason || null,
        })
      );

      const returns = await Promise.all(returnPromises);
      const totalRefund = returns.reduce((sum, r) => sum + r.refund_amount, 0);

      toast.success(`Return processed! Refund: R ${totalRefund.toFixed(2)}`);

      setRefundModal({
        open: true,
        items: cart.map((item, idx) => ({
          name: item.product.name,
          quantity: item.quantity,
          refund: returns[idx].refund_amount,
        })),
        total: totalRefund,
      });

      clearCart();
      setShowCart(false);

      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ["products-for-sale"] });
        qc.invalidateQueries({ queryKey: ["products"] });
      }, 100);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to process return");
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeRefundModal = () => {
    setRefundModal({ open: false, items: [], total: 0 });
  };

  const handleSell = async () => {
    if (isSubmitting || cart.length === 0) return;

    // Validate all items
    for (const item of cart) {
      if (item.quantity > item.product.quantity) {
        toast.error(
          `Only ${item.product.quantity} of ${item.product.name} in stock`
        );
        return;
      }
    }

    if (paymentMethod === "cash" && paymentAmountNum < cartTotal) {
      toast.error("Payment amount is less than total");
      return;
    }

    if (!isOnline) {
      const offlineSale = {
        id:
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `offline-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        createdAt: new Date().toISOString(),
        paymentMethod,
        paymentAmount: paymentMethod === "cash" ? paymentAmountNum : cartTotal,
        change,
        total: cartTotal,
        items: cart.map((item) => ({
          product_id: item.product.id,
          name: item.product.name,
          price: item.product.price,
          quantity: item.quantity,
          subtotal: item.product.price * item.quantity,
        })),
      };

      updateOfflineQueue([...offlineQueue, offlineSale]);
      const updatedProducts = cachedProducts.map((product) => {
        const sold = offlineSale.items.find(
          (item) => item.product_id === product.id
        );
        if (!sold) return product;
        const nextQty = Math.max(0, (product.quantity || 0) - sold.quantity);
        return { ...product, quantity: nextQty };
      });
      setCachedProductsState(updatedProducts);
      setCachedProducts(updatedProducts);
      toast.success("Sale saved offline. Will sync when online.");

      setReceiptModal({
        open: true,
        saleIds: [],
        receiptId: String(offlineSale.id).slice(0, 8).toUpperCase(),
        total: cartTotal,
        items: offlineSale.items,
        paymentMethod: paymentMethod,
        paymentAmount: offlineSale.paymentAmount,
        change: offlineSale.change,
        offline: true,
        customer: selectedCustomer,
        cashierName: profileQuery.data?.name || null,
        createdAt: offlineSale.createdAt,
      });
      setReceiptEmail(selectedCustomer?.email || "");

      clearCart();
      setShowCart(false);
      return;
    }

    setIsSubmitting(true);

    try {
      // Create sales for each cart item
      const salePromises = cart.map((item) =>
        SalesAPI.create({
          product_id: item.product.id,
          quantity_sold: item.quantity,
          payment_method: paymentMethod,
        })
      );

      const sales = await Promise.all(salePromises);

      toast.success(`Sale complete! Total: R ${cartTotal.toFixed(2)}`);

      setReceiptModal({
        open: true,
        saleIds: sales.map((s) => s.id),
        receiptId: sales?.[0]?.id ? String(sales[0].id) : "",
        total: cartTotal,
        items: cart.map((item) => ({
          name: item.product.name,
          quantity: item.quantity,
          price: item.product.price,
          subtotal: item.product.price * item.quantity,
        })),
        paymentMethod: paymentMethod,
        paymentAmount: paymentMethod === "cash" ? paymentAmountNum : cartTotal,
        change: change,
        offline: false,
        customer: selectedCustomer,
        cashierName: profileQuery.data?.name || null,
        createdAt: sales?.[0]?.timestamp || new Date().toISOString(),
      });
      setReceiptEmail(selectedCustomer?.email || "");

      clearCart();
      setShowCart(false);

      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ["products-for-sale"] });
        qc.invalidateQueries({ queryKey: ["recent-sales"] });
        qc.invalidateQueries({ queryKey: ["products"] });
      }, 100);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to process sale");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendReceipt = async () => {
    if (receiptModal.saleIds.length === 0) return;
    if (!isOnline || receiptModal.offline) {
      toast.error("Receipts can be sent when you are back online");
      return;
    }

    const email = receiptEmail.trim();
    if (!email) {
      toast.error("Please enter a customer email");
      return;
    }

    setSendingReceipt(true);
    try {
      // Every line of the sale goes on the one receipt.
      const result = await NotificationsAPI.sendReceipt({
        sale_id: receiptModal.saleIds[0],
        sale_ids: receiptModal.saleIds,
        customer_email: email,
        send_email: true,
        payment_method: receiptModal.paymentMethod,
        payment_amount: receiptModal.paymentAmount,
        change_amount: receiptModal.change,
        customer_id: receiptModal.customer?.id || null,
      });

      if (result.success) {
        toast.success("Receipt sent to " + email);
        closeReceiptModal();
      } else {
        const failedResults = result.results?.filter((r) => !r.success) || [];
        if (failedResults.length > 0) {
          const errorMsg = failedResults[0].message || "Failed to send receipt";
          toast.error(errorMsg);
        } else {
          toast.error("Failed to send receipt");
        }
      }
    } catch (e) {
      const detail = e?.response?.data?.detail;
      toast.error(detail || "Failed to send receipt");
    } finally {
      setSendingReceipt(false);
    }
  };

  // The slip as the customer gets it: on screen, on paper, on WhatsApp. The
  // emailed one is built server-side from the same sale.
  const receiptStore = profileQuery.data?.store || {
    name: profileQuery.data?.store_name || "Your Store",
  };
  const receipt = useMemo(
    () =>
      buildReceipt({
        store: receiptStore,
        items: receiptModal.items,
        total: receiptModal.total,
        paymentMethod: receiptModal.paymentMethod,
        paymentAmount: receiptModal.paymentAmount,
        change: receiptModal.change,
        number: receiptModal.receiptId,
        customer: receiptModal.customer,
        cashier: receiptModal.cashierName,
        date: receiptModal.createdAt,
        offline: receiptModal.offline,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [receiptModal, profileQuery.data]
  );

  // Share the receipt as a WhatsApp message. With the customer's number on
  // file it opens their chat directly; otherwise the cashier picks the chat.
  const handleWhatsAppReceipt = () => {
    openExternalUrl(whatsappUrl(receiptText(receipt), receiptModal.customer?.phone));
  };

  const closeReceiptModal = () => {
    setReceiptModal({
      open: false,
      saleIds: [],
      receiptId: "",
      total: 0,
      items: [],
      paymentMethod: "cash",
      paymentAmount: 0,
      change: 0,
      offline: false,
      customer: null,
      cashierName: null,
      createdAt: null,
    });
    setReceiptEmail("");
  };

  // Check if product is in cart
  const getCartQuantity = (productId) => {
    const item = cart.find((i) => i.product.id === productId);
    return item?.quantity || 0;
  };
  const hasPendingOfflineSales = offlineQueue.length > 0;
  const canSendReceipt = isOnline && !receiptModal.offline;

  return (
    <div className="min-h-[calc(100vh-8rem)] space-y-3 sm:space-y-4 pb-24 lg:pb-0">
      {/* Mobile: Floating Cart Button */}
      {cart.length > 0 && !showCart && (
        <button
          onClick={() => setShowCart(true)}
          className={`lg:hidden fixed mobile-fab-offset right-5 z-40 w-14 h-14 text-white rounded-full shadow-lg flex items-center justify-center transition-transform active:scale-95 ${
            mode === "return" 
              ? "bg-amber-600 hover:bg-amber-700" 
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {mode === "return" ? <RotateCcw size={24} /> : <ShoppingCart size={24} />}
          <span className={`absolute -top-1 -right-1 w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${
            mode === "return" ? "bg-amber-400 text-amber-900" : "bg-emerald-500 text-white"
          }`}>
            {cartItemCount}
          </span>
        </button>
      )}

      {/* Mobile: Cart Slide-Over */}
      {showCart && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowCart(false)}
          />
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-sm bg-white dark:bg-slate-900 shadow-2xl flex flex-col">
            <div className={`flex items-center justify-between px-4 py-3 border-b ${mode === "return" ? "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20" : "border-slate-200 dark:border-slate-700"}`}>
              <h2 className={`text-lg font-bold flex items-center gap-2 ${mode === "return" ? "text-amber-700 dark:text-amber-300" : "text-slate-800 dark:text-white"}`}>
                {mode === "return" ? <RotateCcw size={20} /> : <ShoppingCart size={20} />}
                {mode === "return" ? `Return (${cartItemCount})` : `Cart (${cartItemCount})`}
              </h2>
              <button
                onClick={() => setShowCart(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">{renderCartPanel()}</div>
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 h-full">
        {/* Products Grid */}
        <div className="flex-1 flex flex-col min-h-0">
          <Card className="flex-1 flex flex-col">
            <CardHeader className="pb-3 flex-shrink-0 px-4 py-3 sm:px-6 sm:py-4">
              <div className="flex flex-col gap-3">
                {/* Mode Toggle */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl ring-1 ring-slate-200/60 dark:ring-slate-800">
                    <button
                      onClick={() => switchMode("sale")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ease-out-expo ${
                        mode === "sale"
                          ? "bg-white dark:bg-slate-900 text-brand-700 dark:text-brand-300 shadow-soft"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                      }`}
                    >
                      <ShoppingCart size={15} />
                      <span className="hidden sm:inline">Sale</span>
                    </button>
                    <button
                      onClick={() => switchMode("return")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ease-out-expo ${
                        mode === "return"
                          ? "bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-300 shadow-soft"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                      }`}
                    >
                      <RotateCcw size={15} />
                      <span className="hidden sm:inline">Return</span>
                    </button>
                  </div>
                  {parkedSales.length > 0 && (
                    <button
                      onClick={() => setShowParked(true)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 ring-1 ring-inset ring-violet-200/60 dark:ring-violet-900/40 hover:bg-violet-100 dark:hover:bg-violet-950/60 transition-colors"
                      title="Parked sales — click to recall"
                    >
                      <History size={14} />
                      Parked ({parkedSales.length})
                    </button>
                  )}
                  </div>
                  <div className="text-right">
                    <CardTitle className={`text-base sm:text-lg ${mode === "return" ? "text-amber-600 dark:text-amber-400" : ""}`}>
                      {mode === "sale" ? t("sell.select_product") : "Select Product to Return"}
                    </CardTitle>
                    <CardDescription className="hidden sm:block">
                      {mode === "sale" ? "Tap products to add to cart" : "Tap products to add to return"}
                    </CardDescription>
                  </div>
                </div>
                {!isOnline && (
                  <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                    <AlertCircle className="h-4 w-4" />
                    Offline mode: sales will be saved and synced later.
                  </div>
                )}
                {isOnline && usingCachedProducts && (
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                    <AlertCircle className="h-4 w-4" />
                    Using cached products. Data may be outdated.
                  </div>
                )}
                {isOnline && hasPendingOfflineSales && (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      {offlineQueue.length} offline sale
                      {offlineQueue.length > 1 ? "s" : ""} pending sync.
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => syncOfflineSales("manual")}
                      disabled={isSyncing}
                    >
                      {isSyncing ? "Syncing..." : "Sync now"}
                    </Button>
                  </div>
                )}
                {/* Search + Scan */}
                <div className="flex gap-2">
                  <div className="relative flex-1 min-w-0">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      placeholder={t("products.search_placeholder")}
                      value={searchQuery}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      className="w-full pl-10 pr-4 h-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:border-brand-500 focus:shadow-focus-ring outline-none transition-all duration-200 ease-out-expo"
                    />
                  </div>
                  <button
                    onClick={() => setShowScanner(true)}
                    className="flex items-center gap-1.5 px-3.5 h-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium text-slate-600 dark:text-slate-300 hover:border-brand-400 hover:text-brand-600 dark:hover:text-brand-400 transition-all duration-200 ease-out-expo flex-shrink-0"
                    title="Scan a barcode (camera, USB scanner or manual entry)"
                  >
                    <ScanLine size={18} />
                    <span className="hidden sm:inline">Scan</span>
                  </button>
                </div>

                {/* Keyboard shortcut hints (desktop) */}
                <p className="hidden lg:block text-[11px] text-slate-400 dark:text-slate-500 select-none">
                  Shortcuts: <kbd className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono">/</kbd> search
                  · <kbd className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono">F2</kbd> scan
                  · <kbd className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono">F4</kbd> cash/card
                  · <kbd className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono">F9</kbd> complete sale
                </p>

                {/* Today at a glance */}
                {todayStats && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-50 dark:bg-accent-950/30 ring-1 ring-inset ring-accent-200/60 dark:ring-accent-900/40 text-xs font-semibold text-accent-700 dark:text-accent-300 tabular-nums">
                      <TrendingUp size={13} />
                      Today: R {todayStats.revenue.toFixed(2)}
                    </span>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800/80 ring-1 ring-inset ring-slate-200/70 dark:ring-slate-700/60 text-xs font-medium text-slate-600 dark:text-slate-300 tabular-nums">
                      {todayStats.count} sale{todayStats.count === 1 ? "" : "s"}
                    </span>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto pb-4 px-4 py-3 sm:px-6 sm:py-4">
              {productsQuery.isLoading && !usingCachedProducts ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-3 sm:gap-4">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <div
                      key={i}
                      className="aspect-square bg-slate-100 dark:bg-slate-700 rounded-xl animate-pulse"
                    />
                  ))}
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Package className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium">
                    {searchQuery
                      ? "No products match your search"
                      : t("products.no_products")}
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-3 sm:gap-4">
                    {paginatedProducts.map((p) => {
                      const inCart = getCartQuantity(p.id);
                      return (
                        <button
                          key={p.id}
                          onClick={() => addToCart(p)}
                          disabled={p.quantity === 0}
                          className={`group relative flex flex-col aspect-square rounded-2xl border text-left transition-all duration-200 ease-out-expo overflow-hidden active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 ${
                            inCart > 0
                              ? "border-brand-600 bg-brand-50/30 dark:bg-brand-950/20 shadow-brand"
                              : p.quantity === 0
                              ? "border-slate-200 dark:border-slate-800 opacity-60 cursor-not-allowed bg-white dark:bg-slate-900"
                              : "border-slate-200/80 dark:border-slate-800 hover:border-brand-300 dark:hover:border-brand-700 hover:shadow-soft-lg hover:-translate-y-0.5 bg-white dark:bg-slate-900"
                          }`}
                        >
                          {/* Product Image */}
                          <div className="flex-1 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center min-h-0 overflow-hidden">
                            {p.image_url ? (
                              <img
                                src={p.image_url}
                                alt={p.name}
                                className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
                                loading="lazy"
                              />
                            ) : (
                              <ImageIcon className="w-8 h-8 sm:w-10 sm:h-10 text-slate-300 dark:text-slate-700" />
                            )}
                          </div>

                          {/* Product Info - Horizontal Layout */}
                          <div className="px-2.5 sm:px-3 py-2 flex items-center justify-between gap-2 flex-shrink-0 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-white truncate leading-tight">
                                {p.name}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <p className="text-sm font-bold tabular-nums text-brand-600 dark:text-brand-400">
                                  R{Number(p.price).toFixed(0)}
                                </p>
                                {p.sku && (
                                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono truncate">
                                    {p.sku}
                                  </p>
                                )}
                              </div>
                            </div>
                            <span
                              className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ring-1 ring-inset flex-shrink-0 tabular-nums ${
                                p.quantity === 0
                                  ? "bg-red-50 ring-red-200/60 text-red-700 dark:bg-red-950/30 dark:ring-red-900/40 dark:text-red-300"
                                  : p.quantity <= 5
                                  ? "bg-amber-50 ring-amber-200/60 text-amber-700 dark:bg-amber-950/30 dark:ring-amber-900/40 dark:text-amber-300"
                                  : "bg-accent-50 ring-accent-200/60 text-accent-700 dark:bg-accent-950/30 dark:ring-accent-900/40 dark:text-accent-300"
                              }`}
                            >
                              {p.quantity === 0 ? "Out" : p.quantity}
                            </span>
                          </div>

                          {/* In cart indicator */}
                          {inCart > 0 && (
                            <div className="absolute top-2 right-2 min-w-[24px] h-6 px-1.5 bg-brand-600 rounded-full flex items-center justify-center text-white text-xs font-bold tabular-nums shadow-brand animate-scale-in">
                              {inCart}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          setCurrentPage((p) => Math.max(1, p - 1))
                        }
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft size={16} />
                      </Button>
                      <span className="text-sm text-slate-600 dark:text-slate-400 px-3 min-w-[60px] text-center">
                        {currentPage} / {totalPages}
                      </span>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          setCurrentPage((p) => Math.min(totalPages, p + 1))
                        }
                        disabled={currentPage === totalPages}
                      >
                        <ChevronRight size={16} />
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Cart Panel - Desktop only */}
        <div className="hidden lg:block w-80 xl:w-96 flex-shrink-0">
          <Card className="sticky top-4 flex flex-col max-h-[calc(100vh-8rem)]">
            <CardHeader className={`pb-3 border-b flex-shrink-0 ${mode === "return" ? "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/20" : "border-slate-100 dark:border-slate-800"}`}>
              <div className="flex items-center justify-between">
                <CardTitle className={`flex items-center gap-2 ${mode === "return" ? "text-amber-700 dark:text-amber-300" : ""}`}>
                  {mode === "return" ? <RotateCcw className="w-5 h-5" /> : <ShoppingCart className="w-5 h-5" />}
                  {mode === "return" ? `Return (${cartItemCount})` : `Cart (${cartItemCount})`}
                </CardTitle>
                {cart.length > 0 && (
                  <button
                    onClick={clearCart}
                    className="text-xs text-red-500 hover:text-red-600 font-medium"
                  >
                    Clear All
                  </button>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto py-4">
              {renderCartPanel()}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Parked Sales Modal */}
      {showParked && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowParked(false)}
          />
          <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-5 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <History size={20} className="text-violet-500" />
                Parked sales
              </h3>
              <button
                onClick={() => setShowParked(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500"
              >
                <X size={20} />
              </button>
            </div>

            {parkedSales.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-6 text-center">
                Nothing parked. Add items to the cart and press “Park this sale”.
              </p>
            ) : (
              <div className="space-y-2">
                {parkedSales.map((entry) => {
                  const itemCount = entry.cart.reduce((s, i) => s + i.quantity, 0);
                  return (
                    <div
                      key={entry.id}
                      className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 ring-1 ring-slate-200/60 dark:ring-slate-700"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">
                          {entry.customer?.name ? `${entry.customer.name} · ` : ""}
                          {itemCount} item{itemCount === 1 ? "" : "s"} · R {parkedSaleTotal(entry).toFixed(2)}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {new Date(entry.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} ·{" "}
                          {entry.cart.map((i) => `${i.quantity}× ${i.product.name}`).join(", ").slice(0, 60)}
                        </p>
                      </div>
                      <button
                        onClick={() => handleResumeParked(entry)}
                        className="p-2 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors flex-shrink-0"
                        title="Resume this sale"
                      >
                        <PlayCircle size={20} />
                      </button>
                      <button
                        onClick={() => handleDiscardParked(entry.id)}
                        className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors flex-shrink-0"
                        title="Discard"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Barcode Scanner Modal */}
      {showScanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowScanner(false)}
          />
          <div className="relative w-full max-w-md">
            <BarcodeScanner
              onProductFound={(resp) => {
                const full =
                  allProducts.find((p) => p.id === resp.product_id) || {
                    id: resp.product_id,
                    name: resp.name,
                    price: resp.price,
                    quantity: resp.quantity,
                  };
                if (full.quantity === 0) {
                  beepError();
                  toast.error(`${full.name} is out of stock`);
                  return;
                }
                beepSuccess();
                addToCart(full);
              }}
              onClose={() => setShowScanner(false)}
            />
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {receiptModal.open && (
        <div className="print-unclip fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="print-unclip absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeReceiptModal}
          />
          <div className="print-unclip relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <button
              onClick={closeReceiptModal}
              className="absolute top-4 right-4 p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 dark:text-slate-400"
            >
              <X size={20} />
            </button>

            {/* Receipt Header */}
            <div className="text-center mb-5">
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                <Check className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-2xl font-bold text-slate-800 dark:text-white">
                Sale Complete!
              </h3>
              {receiptModal.offline && (
                <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
                  Saved offline. Sync to update inventory.
                </p>
              )}
            </div>

            {/* The slip: this block is what prints. */}
            <ReceiptSlip receipt={receipt} className="mb-6" />

            {/* Send Receipt Form */}
            <div className="space-y-4 border-t border-slate-200 dark:border-slate-700 pt-4">
              <p className="text-sm text-slate-600 dark:text-slate-300 text-center">
                Send receipt to customer (optional)
              </p>
              {!canSendReceipt && (
                <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
                  Receipts can be sent when you are back online.
                </p>
              )}

              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="email"
                  placeholder="customer@email.com"
                  value={receiptEmail}
                  onChange={(e) => setReceiptEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Android's WebView has no window.print(), so the button is
                    hidden there rather than doing nothing when tapped. */}
                {!isCapacitorNative() && (
                  <Button
                    variant="outline"
                    onClick={() => window.print()}
                    title="Print this receipt"
                  >
                    <Printer size={16} />
                    Print
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={handleWhatsAppReceipt}
                  title="Share the receipt via WhatsApp"
                >
                  <Share2 size={16} />
                  WhatsApp
                </Button>
                <Button
                  variant="secondary"
                  onClick={closeReceiptModal}
                >
                  Done
                </Button>
                <Button
                  onClick={handleSendReceipt}
                  disabled={
                    sendingReceipt || !receiptEmail.trim() || !canSendReceipt
                  }
                >
                  <Send size={16} />
                  {sendingReceipt ? "..." : "Email"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {refundModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeRefundModal}
          />
          <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
            <button
              onClick={closeRefundModal}
              className="absolute top-4 right-4 p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 dark:text-slate-400"
            >
              <X size={20} />
            </button>

            {/* Refund Header */}
            <div className="text-center mb-6">
              <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <RotateCcw className="w-10 h-10 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="text-2xl font-bold text-slate-800 dark:text-white">
                Return Processed!
              </h3>
              <p className="text-slate-500 dark:text-slate-400 mt-1">
                Stock has been added back to inventory
              </p>
            </div>

            {/* Refund Details */}
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 mb-6 space-y-3">
              {/* Items */}
              <div className="space-y-2 pb-3 border-b border-amber-200 dark:border-amber-700">
                {refundModal.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-300">
                      {item.quantity}x {item.name}
                    </span>
                    <span className="font-medium text-amber-700 dark:text-amber-300">
                      R {item.refund.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="pt-2">
                <div className="flex justify-between items-center">
                  <span className="text-amber-700 dark:text-amber-300 font-semibold text-lg">
                    Total Refund
                  </span>
                  <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                    R {refundModal.total.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <Button
              variant="secondary"
              className="w-full"
              onClick={closeRefundModal}
            >
              Done
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  function renderCartPanel() {
    if (cart.length === 0) {
      const isReturn = mode === "return";
      const Icon = isReturn ? RotateCcw : ShoppingCart;
      return (
        <div className="h-full flex flex-col items-center justify-center py-12 text-center">
          <div
            className={`mb-4 rounded-3xl p-5 ring-1 ${
              isReturn
                ? "bg-amber-50 dark:bg-amber-950/40 ring-amber-100 dark:ring-amber-900/40"
                : "bg-brand-50 dark:bg-brand-950/40 ring-brand-100 dark:ring-brand-900/40"
            }`}
          >
            <Icon className={`w-7 h-7 ${isReturn ? "text-amber-600 dark:text-amber-400" : "text-brand-600 dark:text-brand-400"}`} />
          </div>
          <p className="font-display text-base font-semibold text-slate-800 dark:text-slate-100">
            {isReturn ? "No items to return" : "Cart is empty"}
          </p>
          <p className="text-sm mt-1 text-slate-500 dark:text-slate-400">
            {isReturn ? "Tap products to add to return" : "Tap products to add"}
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Cart Items */}
        <div className="space-y-2 max-h-[40vh] overflow-auto">
          {cart.map((item) => (
            <div
              key={item.product.id}
              className="flex gap-3 p-2 sm:p-3 bg-slate-50 dark:bg-slate-800 rounded-xl"
            >
              {/* Product Image */}
              <div className="w-11 h-11 sm:w-12 sm:h-12 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                {item.product.image_url ? (
                  <img
                    src={item.product.image_url}
                    alt={item.product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Package className="w-5 h-5 text-slate-400" />
                )}
              </div>

              {/* Product Info */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-slate-800 dark:text-white truncate">
                  {item.product.name}
                </p>
                <p className="text-xs text-slate-500">
                  R {Number(item.product.price).toFixed(2)} each
                </p>
              </div>

              {/* Quantity Controls */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() =>
                    updateCartQuantity(item.product.id, item.quantity - 1)
                  }
                  className="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300"
                >
                  <Minus size={12} />
                </button>
                <span className="w-7 sm:w-8 text-center font-bold text-slate-800 dark:text-white text-sm">
                  {item.quantity}
                </span>
                <button
                  onClick={() =>
                    updateCartQuantity(item.product.id, item.quantity + 1)
                  }
                  disabled={item.quantity >= item.product.quantity}
                  className="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 disabled:opacity-50"
                >
                  <Plus size={12} />
                </button>
                <button
                  onClick={() => removeFromCart(item.product.id)}
                  className="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 ml-1"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Customer Selection (Sale mode only) */}
        {mode === "sale" && (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Customer (Optional)
            </label>
            {selectedCustomer ? (
              <div className="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-sm">
                    {selectedCustomer.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-sm text-slate-800 dark:text-white">{selectedCustomer.name}</p>
                    {selectedCustomer.loyalty_points > 0 && (
                      <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                        <Gift size={10} /> {selectedCustomer.loyalty_points} points
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={clearCustomer}
                  className="p-1 hover:bg-blue-100 dark:hover:bg-blue-800 rounded"
                >
                  <X size={16} className="text-slate-500" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <button
                  onClick={() => setShowCustomerSearch(!showCustomerSearch)}
                  className="w-full flex items-center gap-2 p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 hover:border-blue-400 text-slate-500 dark:text-slate-400 text-sm"
                >
                  <User size={16} />
                  <span>Add customer</span>
                </button>
                
                {showCustomerSearch && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto">
                    <div className="p-2">
                      <input
                        type="text"
                        placeholder="Search customers..."
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
                        autoFocus
                      />
                    </div>
                    {customersQuery.isLoading ? (
                      <div className="p-3 text-center text-sm text-slate-500">Loading...</div>
                    ) : customersQuery.data?.length === 0 ? (
                      <div className="p-3 text-center text-sm text-slate-500">No customers found</div>
                    ) : (
                      <div className="py-1">
                        {customersQuery.data?.map((customer) => (
                          <button
                            key={customer.id}
                            onClick={() => handleSelectCustomer(customer)}
                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-left"
                          >
                            <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center text-xs font-bold">
                              {customer.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-800 dark:text-white truncate">{customer.name}</p>
                              <p className="text-xs text-slate-500 truncate">{customer.email || customer.phone || 'No contact'}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Payment Method (Sale mode only) */}
        {mode === "sale" && (
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Payment Method
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setPaymentMethod("cash")}
                className={`flex items-center justify-center gap-2 p-2.5 sm:p-3 rounded-xl border-2 transition-all ${
                  paymentMethod === "cash"
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                    : "border-slate-200 dark:border-slate-600 hover:border-slate-300 text-slate-600 dark:text-slate-400"
                }`}
              >
                <Banknote size={18} />
                <span className="font-semibold text-sm sm:text-base">Cash</span>
              </button>
              <button
                onClick={() => {
                  setPaymentMethod("card");
                  setPaymentAmount("");
                }}
                className={`flex items-center justify-center gap-2 p-2.5 sm:p-3 rounded-xl border-2 transition-all ${
                  paymentMethod === "card"
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                    : "border-slate-200 dark:border-slate-600 hover:border-slate-300 text-slate-600 dark:text-slate-400"
                }`}
              >
                <CreditCard size={18} />
                <span className="font-semibold text-sm sm:text-base">Card</span>
              </button>
            </div>
          </div>
        )}

        {/* Return Reason (Return mode only) */}
        {mode === "return" && (
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Return Reason (Optional)
            </label>
            <select
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none"
            >
              <option value="">Select reason...</option>
              <option value="defective">Defective product</option>
              <option value="wrong_item">Wrong item</option>
              <option value="not_needed">No longer needed</option>
              <option value="damaged">Damaged on arrival</option>
              <option value="other">Other</option>
            </select>
          </div>
        )}

        {/* Payment Amount (for cash in sale mode) */}
        {mode === "sale" && paymentMethod === "cash" && (
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Amount Tendered
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-base sm:text-lg">
                R
              </span>
              <input
                type="number"
                step="0.01"
                min={cartTotal}
                placeholder={cartTotal.toFixed(2)}
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 sm:py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white text-lg sm:text-xl font-bold focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
              />
            </div>
            {/* Quick amount buttons */}
            <div className="grid grid-cols-3 gap-2 mt-2">
              {[
                Math.ceil(cartTotal / 10) * 10,
                Math.ceil(cartTotal / 50) * 50,
                Math.ceil(cartTotal / 100) * 100,
              ]
                .filter((v, i, a) => a.indexOf(v) === i && v >= cartTotal)
                .slice(0, 3)
                .map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setPaymentAmount(amount.toString())}
                    className="py-2 text-sm font-semibold rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                  >
                    R {amount}
                  </button>
                ))}
            </div>
          </div>
        )}

        {/* Total & Change / Refund */}
        <div className={`pt-4 border-t space-y-3 ${mode === "return" ? "border-amber-200 dark:border-amber-700" : "border-slate-200 dark:border-slate-700"}`}>
          <div className="flex justify-between items-center">
            <span className="text-slate-600 dark:text-slate-400 font-medium">
              {mode === "return" ? "Refund Total" : t("sell.total")} ({cartItemCount} items)
            </span>
            <span className={`text-xl sm:text-3xl font-bold ${mode === "return" ? "text-amber-600 dark:text-amber-400" : "text-slate-800 dark:text-white"}`}>
              R {cartTotal.toFixed(2)}
            </span>
          </div>

          {mode === "sale" && paymentMethod === "cash" && paymentAmountNum > 0 && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
              <div className="flex justify-between items-center text-sm mb-1">
                <span className="text-slate-600 dark:text-slate-400">
                  Tendered
                </span>
                <span className="text-slate-800 dark:text-slate-200 font-medium">
                  R {paymentAmountNum.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                  Change
                </span>
                <span
                  className={`text-xl sm:text-2xl font-bold ${
                    change >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  R {change.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {mode === "return" && (
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 text-sm">
                <ArrowLeftRight size={16} />
                <span>Stock will be added back to inventory</span>
              </div>
            </div>
          )}

          {mode === "sale" ? (
            <>
              <Button
                className="w-full h-14 text-lg"
                size="lg"
                onClick={handleSell}
                disabled={isSubmitting || !canCompleteSale}
              >
                <ShoppingCart size={24} />
                {isSubmitting ? "Processing..." : t("sell.complete_sale")}
              </Button>
              <button
                onClick={handleParkSale}
                className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/30 rounded-xl transition-colors"
                title="Save this cart aside and serve the next customer"
              >
                <PauseCircle size={16} />
                Park this sale for later
              </button>
            </>
          ) : (
            <Button
              className="w-full h-14 text-lg bg-amber-600 hover:bg-amber-700"
              size="lg"
              onClick={handleReturn}
              disabled={isSubmitting || cart.length === 0 || !isOnline}
            >
              <RotateCcw size={24} />
              {isSubmitting ? "Processing..." : "Process Return"}
            </Button>
          )}

          {mode === "sale" && paymentMethod === "cash" && !canCompleteSale && paymentAmount && (
            <p className="text-xs text-red-500 text-center">
              Amount must be at least R {cartTotal.toFixed(2)}
            </p>
          )}

          {mode === "return" && !isOnline && (
            <p className="text-xs text-amber-600 text-center">
              Returns require an internet connection
            </p>
          )}
        </div>
      </div>
    );
  }
}
