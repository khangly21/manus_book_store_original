import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { cn, formatPrice, truncateHash } from "@/lib/utils";
import { getLoginUrl } from "@/const";
import {
  ArrowLeft, ArrowRight, Bitcoin, CheckCircle, Clock, Copy,
  ExternalLink, Loader2, Shield, Zap, AlertCircle, BookOpen
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";

type Step = "review" | "shipping" | "payment" | "confirming" | "confirmed";
type Currency = "ETH" | "BTC" | "LTC" | "USDT";

const CURRENCY_INFO: Record<Currency, { name: string; color: string; icon: string; confirmTime: string; network?: string; badge?: string }> = {
  ETH: { name: "Ethereum", color: "text-blue-400", icon: "Ξ", confirmTime: "~30 seconds" },
  BTC: { name: "Bitcoin", color: "text-orange-400", icon: "₿", confirmTime: "~10 minutes" },
  LTC: { name: "Litecoin", color: "text-gray-300", icon: "Ł", confirmTime: "~2.5 minutes" },
  USDT: { name: "Tether (BEP-20)", color: "text-green-400", icon: "₮", confirmTime: "~3 seconds", network: "BNB Smart Chain", badge: "BSC" },
};

export default function Checkout() {
  const { isAuthenticated, user } = useAuth();
  const [, navigate] = useLocation();
  const [step, setStep] = useState<Step>("review");
  const [currency, setCurrency] = useState<Currency>("USDT");
  const [shipping, setShipping] = useState({ name: "", address: "", city: "", country: "US", zip: "" });
  const [orderId, setOrderId] = useState<number | null>(null);
  const [txData, setTxData] = useState<any>(null);
  const [confirmations, setConfirmations] = useState(0);
  const [txId, setTxId] = useState<number | null>(null);
  const confirmIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const utils = trpc.useUtils();

  const { data: cartItems } = trpc.cart.get.useQuery(undefined, { enabled: isAuthenticated });
  const { data: rates } = trpc.payment.getRates.useQuery();

  const subtotal = cartItems?.reduce((s, i) => s + Number(i.book?.price ?? 0) * i.quantity, 0) ?? 0;
  const rate = rates?.[currency] ?? 1;
  const cryptoAmount = (subtotal / rate).toFixed(8);

  const createOrder = trpc.orders.create.useMutation();
  const initiatePayment = trpc.payment.initiate.useMutation();
  const [emailDeliveryInfo, setEmailDeliveryInfo] = useState<{ sent: boolean; sentTo?: string } | null>(null);

  const confirmPayment = trpc.payment.confirm.useMutation({
    onSuccess: (data) => {
      utils.cart.get.invalidate();
      utils.orders.myOrders.invalidate();
      setEmailDeliveryInfo({ sent: data.emailSent, sentTo: user?.email ?? undefined });
      setStep("confirmed");
      if (confirmIntervalRef.current) clearInterval(confirmIntervalRef.current);
    },
  });

  // Simulate blockchain confirmations
  useEffect(() => {
    if (step === "confirming" && txId && orderId) {
      let count = 0;
      confirmIntervalRef.current = setInterval(() => {
        count++;
        setConfirmations(count);
        if (count >= 3) {
          clearInterval(confirmIntervalRef.current!);
          confirmPayment.mutate({ orderId: orderId!, txId: txId! });
        }
      }, 2500);
    }
    return () => { if (confirmIntervalRef.current) clearInterval(confirmIntervalRef.current); };
  }, [step, txId, orderId]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="font-display text-2xl font-bold text-foreground mb-2">Sign In Required</h2>
          <p className="text-muted-foreground mb-6">Please sign in to proceed with checkout</p>
          <a href={getLoginUrl()} className="btn-gold px-8 py-3 rounded-xl font-bold">Sign In</a>
        </div>
      </div>
    );
  }

  if (!cartItems?.length && step === "review") {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center">
        <div className="text-center">
          <BookOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="font-display text-2xl font-bold text-foreground mb-2">Your cart is empty</h2>
          <Link href="/catalog" className="btn-gold px-8 py-3 rounded-xl font-bold inline-block mt-4">Browse Books</Link>
        </div>
      </div>
    );
  }

  const handlePlaceOrder = async () => {
    if (!cartItems?.length) return;
    const items = cartItems.map((item) => ({
      bookId: item.bookId,
      quantity: item.quantity,
      price: Number(item.book?.price ?? 0),
      bookTitle: item.book?.title ?? "",
      bookAuthor: item.book?.author ?? "",
      bookCover: item.book?.coverUrl ?? undefined,
    }));
    const result = await createOrder.mutateAsync({
      cryptoCurrency: currency,
      shippingAddress: `${shipping.name}, ${shipping.address}, ${shipping.city}, ${shipping.country} ${shipping.zip}`,
      items,
      totalAmount: subtotal,
    });
    setOrderId(result.orderId);
    setStep("payment");
  };

  const handleInitiatePayment = async () => {
    if (!orderId) return;
    try {
      const result = await initiatePayment.mutateAsync({ orderId, currency, usdAmount: subtotal });
      setTxData(result);
      setTxId(result.txId);
      setStep("confirming");
    } catch (e) {
      toast.error("Payment initiation failed");
    }
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  const steps: { key: Step; label: string }[] = [
    { key: "review", label: "Review" },
    { key: "shipping", label: "Shipping" },
    { key: "payment", label: "Payment" },
    { key: "confirming", label: "Confirming" },
    { key: "confirmed", label: "Complete" },
  ];
  const stepIndex = steps.findIndex((s) => s.key === step);

  return (
    <div className="min-h-screen pt-20 page-enter">
      <div className="container py-8 max-w-5xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/catalog" className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-display text-3xl font-bold text-foreground">Checkout</h1>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 mb-10">
          {steps.map((s, i) => (
            <div key={s.key} className="flex items-center gap-2">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all",
                i < stepIndex ? "bg-green-500 text-white" : i === stepIndex ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
              )}>
                {i < stepIndex ? <CheckCircle className="w-4 h-4" /> : i + 1}
              </div>
              <span className={cn("text-sm hidden sm:block", i === stepIndex ? "text-foreground font-medium" : "text-muted-foreground")}>{s.label}</span>
              {i < steps.length - 1 && <div className={cn("flex-1 h-px min-w-[20px]", i < stepIndex ? "bg-green-500" : "bg-border")} />}
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Step: Review */}
            {step === "review" && (
              <div className="bg-card border border-border rounded-2xl p-6">
                <h2 className="font-display text-xl font-bold text-foreground mb-5">Order Review</h2>
                <div className="space-y-3 mb-6">
                  {cartItems?.map((item) => (
                    <div key={item.id} className="flex gap-3 p-3 bg-secondary rounded-xl">
                      <div className="w-12 h-16 rounded-lg overflow-hidden flex-none bg-navy-light">
                        {item.book?.coverUrl ? <img src={item.book.coverUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><BookOpen className="w-5 h-5 text-primary/30" /></div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground line-clamp-1">{item.book?.title}</p>
                        <p className="text-xs text-muted-foreground">{item.book?.author}</p>
                        <p className="text-xs text-muted-foreground mt-1">Qty: {item.quantity}</p>
                      </div>
                      <span className="text-primary font-bold text-sm">{formatPrice(Number(item.book?.price ?? 0) * item.quantity)}</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => setStep("shipping")} className="btn-gold w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-2">
                  Continue to Shipping <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* Step: Shipping */}
            {step === "shipping" && (
              <div className="bg-card border border-border rounded-2xl p-6">
                <h2 className="font-display text-xl font-bold text-foreground mb-5">Shipping Information</h2>
                <div className="space-y-4">
                  {[
                    { key: "name", label: "Full Name", placeholder: "John Doe" },
                    { key: "address", label: "Street Address", placeholder: "123 Main St" },
                    { key: "city", label: "City", placeholder: "New York" },
                    { key: "zip", label: "ZIP / Postal Code", placeholder: "10001" },
                  ].map((field) => (
                    <div key={field.key}>
                      <label className="text-sm text-muted-foreground mb-1.5 block">{field.label}</label>
                      <input
                        value={shipping[field.key as keyof typeof shipping]}
                        onChange={(e) => setShipping((s) => ({ ...s, [field.key]: e.target.value }))}
                        placeholder={field.placeholder}
                        className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/50"
                      />
                    </div>
                  ))}
                  <div>
                    <label className="text-sm text-muted-foreground mb-1.5 block">Country</label>
                    <select value={shipping.country} onChange={(e) => setShipping((s) => ({ ...s, country: e.target.value }))} className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/50">
                      {["US", "UK", "CA", "AU", "DE", "FR", "JP", "SG"].map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button onClick={() => setStep("review")} className="px-5 py-3 rounded-xl border border-border text-foreground hover:bg-secondary transition-colors font-medium">
                    Back
                  </button>
                  <button
                    onClick={handlePlaceOrder}
                    disabled={!shipping.name || !shipping.address || !shipping.city || createOrder.isPending}
                    className="btn-gold flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {createOrder.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating Order...</> : <>Continue to Payment <ArrowRight className="w-5 h-5" /></>}
                  </button>
                </div>
              </div>
            )}

            {/* Step: Payment */}
            {step === "payment" && (
              <div className="bg-card border border-border rounded-2xl p-6">
                <h2 className="font-display text-xl font-bold text-foreground mb-2">Crypto Payment</h2>
                <p className="text-muted-foreground text-sm mb-6">Select your preferred cryptocurrency to complete the purchase</p>

                {/* Currency selector */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                  {(["USDT", "ETH", "BTC", "LTC"] as Currency[]).map((c) => (
                    <button
                      key={c}
                      onClick={() => setCurrency(c)}
                      className={cn(
                        "p-3 rounded-xl border-2 text-center transition-all relative",
                        currency === c ? "border-primary bg-primary/10" : "border-border hover:border-primary/40 bg-secondary"
                      )}
                    >
                      {CURRENCY_INFO[c].badge && (
                        <span className="absolute -top-2 -right-2 bg-yellow-500 text-[#0a1628] text-[9px] font-black px-1.5 py-0.5 rounded-full">
                          {CURRENCY_INFO[c].badge}
                        </span>
                      )}
                      <div className={cn("text-2xl font-bold mb-1", CURRENCY_INFO[c].color)}>{CURRENCY_INFO[c].icon}</div>
                      <div className="text-sm font-semibold text-foreground">{c}</div>
                      <div className="text-[10px] text-muted-foreground leading-tight">{CURRENCY_INFO[c].name}</div>
                    </button>
                  ))}
                </div>

                {/* BSC network notice for USDT */}
                {currency === "USDT" && (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 mb-4 flex items-start gap-2">
                    <Shield className="w-4 h-4 text-yellow-400 flex-none mt-0.5" />
                    <div className="text-xs text-yellow-400/90">
                      <strong>BNB Smart Chain (BSC) · Chain ID 56</strong><br />
                      Send <strong>USDT BEP-20</strong> only. Do not send ERC-20 USDT — funds will be lost.
                      Network fee paid in BNB (~$0.50).
                    </div>
                  </div>
                )}

                {/* Payment summary */}
                <div className="bg-secondary rounded-xl p-4 mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-muted-foreground">USD Amount</span>
                    <span className="font-bold text-foreground">{formatPrice(subtotal)}</span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-muted-foreground">Exchange Rate</span>
                    <span className="text-sm text-foreground">1 {currency} = {formatPrice(rate)}</span>
                  </div>
                  <div className="border-t border-border pt-2 flex justify-between items-center">
                    <span className="font-bold text-foreground">You Pay</span>
                    <span className={cn("text-xl font-bold", CURRENCY_INFO[currency].color)}>
                      {cryptoAmount} {currency}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                    <Clock className="w-3.5 h-3.5" />
                    Estimated confirmation: {CURRENCY_INFO[currency].confirmTime}
                    {CURRENCY_INFO[currency].network && (
                      <span className="ml-2 bg-yellow-500/20 text-yellow-400 text-[10px] px-1.5 py-0.5 rounded font-medium">
                        {CURRENCY_INFO[currency].network}
                      </span>
                    )}
                  </div>
                </div>

                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-6 flex gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-400 flex-none mt-0.5" />
                  <div className="text-sm text-yellow-400/90">
                    <strong>Demo Mode:</strong> This is a simulated payment. No real cryptocurrency will be transferred. A dummy transaction hash will be generated for demonstration purposes.
                  </div>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setStep("shipping")} className="px-5 py-3 rounded-xl border border-border text-foreground hover:bg-secondary transition-colors font-medium">Back</button>
                  <button
                    onClick={handleInitiatePayment}
                    disabled={initiatePayment.isPending}
                    className="btn-gold flex-1 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2"
                  >
                    {initiatePayment.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Initiating...</> : <><Zap className="w-5 h-5" /> Pay {cryptoAmount} {currency}</>}
                  </button>
                </div>
              </div>
            )}

            {/* Step: Confirming */}
            {step === "confirming" && txData && (
              <div className="bg-card border border-border rounded-2xl p-6">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto mb-4">
                    <div className="w-10 h-10 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                  </div>
                  <h2 className="font-display text-xl font-bold text-foreground mb-1">Awaiting Blockchain Confirmation</h2>
                  <p className="text-muted-foreground text-sm">Your transaction has been broadcast to the {CURRENCY_INFO[currency].name} network</p>
                </div>

                {/* Confirmation progress */}
                <div className="bg-secondary rounded-xl p-4 mb-6">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Confirmations</span>
                    <span className={cn("font-bold", confirmations >= 3 ? "text-green-400" : "text-yellow-400")}>{confirmations} / 3</span>
                  </div>
                  <div className="w-full bg-border rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-yellow-400 to-green-400 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${(confirmations / 3) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 status-pulse">
                    {confirmations === 0 ? "Broadcasting transaction..." : confirmations === 1 ? "First confirmation received..." : confirmations === 2 ? "Almost there..." : "Confirming payment..."}
                  </p>
                </div>

                {/* TX Details */}
                <div className="space-y-3">
                  {[
                    { label: "Transaction Hash", value: txData.txHash, mono: true },
                    { label: "From Wallet", value: txData.fromAddress, mono: true },
                    { label: "To Wallet (Store)", value: txData.toAddress, mono: true },
                    { label: "Amount", value: `${txData.cryptoAmount} ${txData.currency}` },
                    { label: "USD Value", value: formatPrice(txData.usdAmount) },
                    { label: "Network Fee", value: `${txData.networkFee} ${txData.networkFeeCurrency ?? txData.currency}` },
                    ...(txData.network ? [{ label: "Network", value: txData.network }] : []),
                    ...(txData.token ? [{ label: "Token Standard", value: txData.token }] : []),
                  ].map((row) => (
                    <div key={row.label} className="flex items-start justify-between gap-3 py-2 border-b border-border/50">
                      <span className="text-xs text-muted-foreground flex-none">{row.label}</span>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={cn("text-xs text-foreground text-right break-all", row.mono ? "font-mono text-primary" : "font-medium")}>
                          {row.mono ? truncateHash(row.value, 10) : row.value}
                        </span>
                        {row.mono && (
                          <button onClick={() => copyText(row.value, row.label)} className="flex-none">
                            <Copy className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step: Confirmed */}
            {step === "confirmed" && (
              <div className="bg-card border border-border rounded-2xl p-8 text-center">
                <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="w-10 h-10 text-green-400" />
                </div>
                <h2 className="font-display text-3xl font-bold text-foreground mb-2">Payment Confirmed!</h2>
                <p className="text-muted-foreground mb-6">Your order has been placed and payment verified on the blockchain.</p>

                {txData && (
                  <div className="bg-secondary rounded-xl p-4 mb-4 text-left">
                    <p className="text-xs text-muted-foreground mb-1">Transaction Hash</p>
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono text-primary break-all flex-1">{txData.txHash}</code>
                      <button onClick={() => copyText(txData.txHash, "TX Hash")}>
                        <Copy className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                      </button>
                    </div>
                    <p className="text-xs text-green-400 mt-2 flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> 3/3 Confirmations &middot; Payment Verified
                    </p>
                    {txData.explorerLink && (
                      <a
                        href={txData.explorerLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 mt-3 text-xs text-amber-400 hover:text-amber-300 underline underline-offset-2"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        {txData.currency === "USDT" ? "View on BSCScan" :
                         txData.currency === "ETH" ? "View on Etherscan" :
                         txData.currency === "BTC" ? "View on Blockstream" : "View on Explorer"}
                      </a>
                    )}
                    {txData.network && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Network: {txData.network}{txData.chainId ? ` · Chain ID ${txData.chainId}` : ""}
                        {txData.token ? ` · ${txData.token}` : ""}
                      </p>
                    )}
                  </div>
                )}

                {/* Email delivery notification banner */}
                {emailDeliveryInfo && (
                  <div className={`rounded-xl p-4 mb-6 text-left border ${
                    emailDeliveryInfo.sent
                      ? "bg-blue-500/10 border-blue-500/30"
                      : "bg-amber-500/10 border-amber-500/30"
                  }`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-none ${
                        emailDeliveryInfo.sent ? "bg-blue-500/20" : "bg-amber-500/20"
                      }`}>
                        {emailDeliveryInfo.sent
                          ? <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                          : <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        }
                      </div>
                      <div className="flex-1">
                        {emailDeliveryInfo.sent ? (
                          <>
                            <p className="text-sm font-semibold text-blue-300 mb-1">
                              📧 Delivery email sent!
                            </p>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              Your signed download links have been sent to{" "}
                              <strong className="text-foreground">{emailDeliveryInfo.sentTo || "your email address"}</strong>.
                              Each link is protected by an HMAC-SHA256 signature, valid for{" "}
                              <strong className="text-foreground">48 hours</strong> and up to{" "}
                              <strong className="text-foreground">5 downloads</strong>.
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-sm font-semibold text-amber-300 mb-1">
                              ⚠ Email delivery pending
                            </p>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              We couldn't send the delivery email right now. Your books are available in{" "}
                              <Link href="/profile" className="text-primary hover:underline">Order History</Link>{" "}
                              where you can download them directly or request a resend.
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3">
                  <Link href="/profile" className="btn-gold flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2">
                    <ExternalLink className="w-4 h-4" /> View My Orders
                  </Link>
                  <Link href="/catalog" className="flex-1 py-3 rounded-xl border border-border text-foreground hover:bg-secondary transition-colors font-medium flex items-center justify-center">
                    Continue Shopping
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Order Summary Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-card border border-border rounded-2xl p-5 sticky top-24">
              <h3 className="font-display text-lg font-bold text-foreground mb-4">Order Summary</h3>
              <div className="space-y-2 mb-4">
                {cartItems?.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-muted-foreground line-clamp-1 flex-1 mr-2">{item.book?.title} ×{item.quantity}</span>
                    <span className="text-foreground font-medium flex-none">{formatPrice(Number(item.book?.price ?? 0) * item.quantity)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-border pt-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="text-foreground">{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Shipping</span>
                  <span className="text-green-400">Free</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span className="text-foreground">Total</span>
                  <span className="text-primary text-lg">{formatPrice(subtotal)}</span>
                </div>
              </div>
              {step !== "review" && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-1">Paying with</p>
                  <div className={cn("flex items-center gap-2 font-bold", CURRENCY_INFO[currency].color)}>
                    <span className="text-xl">{CURRENCY_INFO[currency].icon}</span>
                    <span>{cryptoAmount} {currency}</span>
                  </div>
                </div>
              )}
              <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                <Shield className="w-3.5 h-3.5 text-green-400" />
                Secured by cryptographic verification
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
