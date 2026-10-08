export interface CheckoutResult {
  transactionId: string;
  status: string;
  reference?: string;
}

export type CheckoutCancelReason = "customer" | "dismissed" | "checkout";

export interface CheckoutCancelContext {
  transactionId: string;
  reason: CheckoutCancelReason;
}

export interface CheckoutOptions {
  publicKey: string;
  transactionId: string;
  checkoutUrl?: string;
  ariaLabel?: string;
  styleNonce?: string;
  closeOnBackdrop?: boolean;
  onLoad?: () => void;
  onSuccess?: (result: CheckoutResult) => void;
  onCancel?: (context: CheckoutCancelContext) => void;
  onError?: (error: Error) => void;
}

export interface CheckoutController {
  destroy: () => void;
}

type CheckoutMessageType = "ready" | "success" | "cancel" | "error";
type CheckoutMessage = {
  source: "tsara-checkout";
  version?: number;
  type: CheckoutMessageType;
  payload?: unknown;
};

const DEFAULT_CHECKOUT_URL = "https://checkout.tsara.ng/";
const STYLE_ATTRIBUTE = "data-tsara-checkout-style";
let activeCleanup: (() => void) | null = null;

function validate(options: CheckoutOptions): URL {
  if (!options || typeof options !== "object") {
    throw new TypeError("Tsara Checkout options are required.");
  }
  if (!/^pk_(test|live)_/.test(options.publicKey)) {
    throw new TypeError("Tsara Checkout requires a public key beginning with pk_test_ or pk_live_.");
  }
  if (typeof options.transactionId !== "string" || !options.transactionId.trim()) {
    throw new TypeError("transactionId is required.");
  }

  const url = new URL(options.checkoutUrl ?? DEFAULT_CHECKOUT_URL);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new TypeError("checkoutUrl must use http or https.");
  }
  url.searchParams.set("trx_id", options.transactionId.trim());
  return url;
}

function checkoutStyles(): string {
  return `
.tsara-checkout-backdrop{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:clamp(10px,2vw,24px);box-sizing:border-box;background:rgba(12,18,31,.68);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
.tsara-checkout-dialog{position:relative;width:min(1120px,100%);height:min(840px,94dvh);box-sizing:border-box;overflow:hidden;border:1px solid rgba(255,255,255,.34);border-radius:22px;background:#fff;box-shadow:0 30px 90px rgba(5,10,20,.34)}
.tsara-checkout-frame{display:block;width:100%;height:100%;border:0;background:#fff;opacity:0;transition:opacity .18s ease}
.tsara-checkout-frame[data-loaded="true"]{opacity:1}
.tsara-checkout-close{position:absolute;top:12px;right:12px;z-index:3;display:grid;width:44px;height:44px;place-items:center;padding:0;border:1px solid rgba(15,23,42,.12);border-radius:999px;background:#fff;color:#151a26;box-shadow:0 8px 24px rgba(15,23,42,.14);font:600 24px/1 Georgia,serif;cursor:pointer}
.tsara-checkout-close:hover{background:#fff7ed;color:#c2410c}
.tsara-checkout-close:focus-visible{outline:3px solid #ff7a00;outline-offset:3px}
.tsara-checkout-loading{position:absolute;inset:0;z-index:2;display:grid;place-items:center;background:linear-gradient(145deg,#fff 0%,#fff9f3 100%);color:#293142;text-align:center}
.tsara-checkout-loading[hidden]{display:none}
.tsara-checkout-loading-inner{display:grid;justify-items:center;gap:14px;padding:24px}
.tsara-checkout-mark{display:grid;width:52px;height:52px;place-items:center;border-radius:18px;background:#ff7100;color:#fff;font:800 25px/1 Georgia,serif;box-shadow:0 12px 30px rgba(255,113,0,.25)}
.tsara-checkout-spinner{width:30px;height:30px;box-sizing:border-box;border:3px solid rgba(255,113,0,.18);border-top-color:#ff7100;border-radius:999px;animation:tsara-checkout-spin .75s linear infinite}
.tsara-checkout-loading-title{margin:0;font:700 18px/1.25 Georgia,serif}
.tsara-checkout-loading-copy{margin:0;color:#667085;font:500 14px/1.5 sans-serif}
.tsara-checkout-sr-only{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}
@keyframes tsara-checkout-spin{to{transform:rotate(360deg)}}
@media(max-width:640px){.tsara-checkout-backdrop{padding:0}.tsara-checkout-dialog{width:100%;height:100dvh;border:0;border-radius:0}.tsara-checkout-close{top:max(10px,env(safe-area-inset-top));right:max(10px,env(safe-area-inset-right))}}
@media(prefers-reduced-motion:reduce){.tsara-checkout-frame{transition:none}.tsara-checkout-spinner{animation-duration:1.5s}}
`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function messageTransactionId(payload: unknown): string | null {
  if (!isRecord(payload)) return null;
  const value = payload.transactionId ?? payload.trx_id;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toResult(payload: unknown, fallbackTransactionId: string): CheckoutResult {
  const data = isRecord(payload) ? payload : {};
  const reference = typeof data.reference === "string" && data.reference ? data.reference : undefined;
  return {
    transactionId: messageTransactionId(data) ?? fallbackTransactionId,
    status: typeof data.status === "string" && data.status ? data.status : "success",
    ...(reference ? { reference } : {}),
  };
}

function toError(payload: unknown): Error {
  if (typeof payload === "string" && payload.trim()) return new Error(payload);
  if (isRecord(payload) && typeof payload.message === "string" && payload.message.trim()) {
    return new Error(payload.message);
  }
  return new Error("Checkout failed.");
}

export function redirect(options: CheckoutOptions): void {
  window.location.assign(validate(options).toString());
}

export function open(options: CheckoutOptions): CheckoutController {
  const url = validate(options);
  activeCleanup?.();

  const transactionId = options.transactionId.trim();
  const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const previousOverflow = document.body.style.overflow;
  let finished = false;
  let loaded = false;

  url.searchParams.set("tsara_sdk", "checkout-js");
  url.searchParams.set("parent_origin", window.location.origin);

  const style = document.createElement("style");
  style.setAttribute(STYLE_ATTRIBUTE, "");
  if (options.styleNonce) style.nonce = options.styleNonce;
  style.textContent = checkoutStyles();
  document.head.append(style);

  const backdrop = document.createElement("div");
  backdrop.className = "tsara-checkout-backdrop";
  backdrop.dataset.tsaraCheckout = transactionId;

  const dialog = document.createElement("div");
  dialog.className = "tsara-checkout-dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "tsara-checkout-title");
  dialog.setAttribute("aria-describedby", "tsara-checkout-status");

  const title = document.createElement("h2");
  title.id = "tsara-checkout-title";
  title.className = "tsara-checkout-sr-only";
  title.textContent = options.ariaLabel ?? "Secure Tsara Checkout";

  const status = document.createElement("p");
  status.id = "tsara-checkout-status";
  status.className = "tsara-checkout-sr-only";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  status.textContent = "Loading secure checkout.";

  const loading = document.createElement("div");
  loading.className = "tsara-checkout-loading";
  loading.innerHTML = '<div class="tsara-checkout-loading-inner"><span class="tsara-checkout-mark" aria-hidden="true">T</span><span class="tsara-checkout-spinner" aria-hidden="true"></span><p class="tsara-checkout-loading-title">Opening secure checkout</p><p class="tsara-checkout-loading-copy">Please wait while we prepare your payment.</p></div>';

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "tsara-checkout-close";
  closeButton.setAttribute("aria-label", "Close Tsara Checkout");
  closeButton.textContent = "×";

  const frame = document.createElement("iframe");
  frame.className = "tsara-checkout-frame";
  frame.title = options.ariaLabel ?? "Secure Tsara Checkout";
  frame.allow = "payment";
  frame.referrerPolicy = "strict-origin-when-cross-origin";
  // Set the target before mounting so the initial about:blank load cannot
  // prematurely fire onLoad and hide the SDK loading state.
  frame.src = url.toString();

  dialog.append(title, status, loading, frame, closeButton);
  backdrop.append(dialog);

  const setLoaded = () => {
    if (loaded || finished) return;
    loaded = true;
    frame.dataset.loaded = "true";
    loading.hidden = true;
    status.textContent = "Secure checkout loaded.";
    options.onLoad?.();
  };

  const destroy = () => {
    window.removeEventListener("message", onMessage);
    document.removeEventListener("keydown", onKeyDown);
    frame.removeEventListener("load", setLoaded);
    frame.removeEventListener("error", onFrameError);
    backdrop.remove();
    style.remove();
    document.body.style.overflow = previousOverflow;
    if (previouslyFocused?.isConnected) previouslyFocused.focus();
    if (activeCleanup === destroy) activeCleanup = null;
  };

  const finish = (callback: () => void) => {
    if (finished) return;
    finished = true;
    destroy();
    callback();
  };

  const cancel = (reason: CheckoutCancelReason) => {
    finish(() => options.onCancel?.({ transactionId, reason }));
  };

  const onFrameError = () => {
    finish(() => options.onError?.(new Error("Unable to load Tsara Checkout.")));
  };

  const onMessage = (event: MessageEvent) => {
    if (event.origin !== url.origin || event.source !== frame.contentWindow) return;
    const message = event.data as Partial<CheckoutMessage>;
    if (!message || message.source !== "tsara-checkout") return;
    if (message.version !== undefined && message.version !== 1) return;
    if (!(["ready", "success", "cancel", "error"] as string[]).includes(String(message.type))) return;

    const incomingTransactionId = messageTransactionId(message.payload);
    if (incomingTransactionId && incomingTransactionId !== transactionId) return;

    if (message.type === "ready") {
      setLoaded();
      return;
    }
    if (message.type === "success") {
      const result = toResult(message.payload, transactionId);
      finish(() => options.onSuccess?.(result));
      return;
    }
    if (message.type === "cancel") {
      cancel("checkout");
      return;
    }
    finish(() => options.onError?.(toError(message.payload)));
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      cancel("dismissed");
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = [closeButton, frame].filter((element) => element.isConnected);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  closeButton.addEventListener("click", () => cancel("dismissed"));
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop && options.closeOnBackdrop !== false) cancel("dismissed");
  });
  frame.addEventListener("load", setLoaded);
  frame.addEventListener("error", onFrameError);
  window.addEventListener("message", onMessage);
  document.addEventListener("keydown", onKeyDown);

  document.body.style.overflow = "hidden";
  document.body.append(backdrop);
  closeButton.focus();

  activeCleanup = destroy;
  return { destroy };
}

export function destroy(): void {
  activeCleanup?.();
}

export const TsaraCheckout = { open, redirect, destroy };
export default TsaraCheckout;
