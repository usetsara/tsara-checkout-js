import { beforeEach, describe, expect, it, vi } from "vitest";
import { destroy, open } from "../src/index";

function checkoutFrame(): HTMLIFrameElement {
  const frame = document.querySelector<HTMLIFrameElement>("iframe.tsara-checkout-frame");
  if (!frame) throw new Error("Checkout iframe was not created.");
  return frame;
}

function send(frame: HTMLIFrameElement, type: string, payload?: unknown, origin = "https://checkout.tsara.ng", version = 1) {
  window.dispatchEvent(new MessageEvent("message", {
    origin,
    source: frame.contentWindow,
    data: { source: "tsara-checkout", version, type, payload },
  }));
}

beforeEach(() => {
  destroy();
  document.head.querySelectorAll("[data-tsara-checkout-style]").forEach((node) => node.remove());
  document.body.innerHTML = "";
  document.body.style.overflow = "";
});

describe("checkout modal", () => {
  it("rejects secret keys", () => {
    expect(() => open({ publicKey: "sk_test_nope", transactionId: "order_1" })).toThrow(/public key/);
  });

  it("prevents duplicate modals", () => {
    open({ publicKey: "pk_test_ok", transactionId: "order_1" });
    open({ publicKey: "pk_test_ok", transactionId: "order_2" });
    expect(document.querySelectorAll("iframe")).toHaveLength(1);
    expect(document.querySelector("[data-tsara-checkout='order_2']")).not.toBeNull();
  });

  it("shows loading state until the iframe is ready", () => {
    const onLoad = vi.fn();
    open({ publicKey: "pk_test_ok", transactionId: "order_1", onLoad });
    const frame = checkoutFrame();
    const loading = document.querySelector<HTMLElement>(".tsara-checkout-loading");

    expect(loading?.hidden).toBe(false);
    send(frame, "ready", { transactionId: "order_1" });
    expect(loading?.hidden).toBe(true);
    expect(frame.dataset.loaded).toBe("true");
    expect(onLoad).toHaveBeenCalledTimes(1);
  });

  it("sets the checkout URL before mounting the iframe", () => {
    const append = document.body.append.bind(document.body);
    const appendSpy = vi.spyOn(document.body, "append").mockImplementation((...nodes) => {
      const frame = (nodes[0] as HTMLElement).querySelector<HTMLIFrameElement>("iframe.tsara-checkout-frame");
      expect(frame?.getAttribute("src")).toContain("https://checkout.tsara.ng/");
      append(...nodes);
    });

    open({ publicKey: "pk_test_ok", transactionId: "order_1" });

    expect(appendSpy).toHaveBeenCalledTimes(1);
    appendSpy.mockRestore();
  });

  it("accepts success only from the checkout frame and restores page state", () => {
    const trigger = document.createElement("button");
    document.body.append(trigger);
    trigger.focus();
    const onSuccess = vi.fn();
    open({ publicKey: "pk_test_ok", transactionId: "order_1", onSuccess });
    const frame = checkoutFrame();

    send(frame, "success", { transactionId: "order_1", status: "success" }, "https://evil.example");
    send(frame, "success", { transactionId: "another_order", status: "success" });
    expect(onSuccess).not.toHaveBeenCalled();

    send(frame, "success", { transactionId: "order_1", status: "success", reference: "ts-100" });
    expect(onSuccess).toHaveBeenCalledWith({ transactionId: "order_1", status: "success", reference: "ts-100" });
    expect(document.querySelector(".tsara-checkout-backdrop")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(document.body.style.overflow).toBe("");
  });

  it("ignores messages from unsupported checkout contract versions", () => {
    const onSuccess = vi.fn();
    open({ publicKey: "pk_test_ok", transactionId: "order_1", onSuccess });
    const frame = checkoutFrame();

    send(frame, "success", { transactionId: "order_1", status: "success" }, "https://checkout.tsara.ng", 2);

    expect(onSuccess).not.toHaveBeenCalled();
    expect(document.querySelector("iframe")).not.toBeNull();
  });

  it("reports checkout errors and closes the modal", () => {
    const onError = vi.fn();
    open({ publicKey: "pk_test_ok", transactionId: "order_1", onError });
    const frame = checkoutFrame();
    send(frame, "error", { transactionId: "order_1", message: "Payment failed." });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(onError.mock.calls[0][0].message).toBe("Payment failed.");
    expect(document.querySelector("iframe")).toBeNull();
  });

  it("supports explicit customer cancellation messages", () => {
    const onCancel = vi.fn();
    open({ publicKey: "pk_test_ok", transactionId: "order_1", onCancel });
    send(checkoutFrame(), "cancel", { transactionId: "order_1", status: "cancelled" });
    expect(onCancel).toHaveBeenCalledWith({ transactionId: "order_1", reason: "checkout" });
  });

  it("supports keyboard dismissal and restores focus", () => {
    const trigger = document.createElement("button");
    document.body.append(trigger);
    trigger.focus();
    const onCancel = vi.fn();
    open({ publicKey: "pk_test_ok", transactionId: "order_1", onCancel });

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(onCancel).toHaveBeenCalledWith({ transactionId: "order_1", reason: "dismissed" });
    expect(document.activeElement).toBe(trigger);
  });

  it("can disable backdrop dismissal", () => {
    const onCancel = vi.fn();
    open({ publicKey: "pk_test_ok", transactionId: "order_1", closeOnBackdrop: false, onCancel });
    const backdrop = document.querySelector<HTMLElement>(".tsara-checkout-backdrop");
    backdrop?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onCancel).not.toHaveBeenCalled();
    expect(document.querySelector("iframe")).not.toBeNull();
  });

  it("destroys without reporting a customer cancellation", () => {
    const onCancel = vi.fn();
    const controller = open({ publicKey: "pk_test_ok", transactionId: "order_1", onCancel });
    controller.destroy();
    expect(onCancel).not.toHaveBeenCalled();
    expect(document.querySelector("iframe")).toBeNull();
    expect(document.querySelector(`[${"data-tsara-checkout-style"}]`)).toBeNull();
  });

  it("adds the trusted parent origin to modal checkout URLs", () => {
    open({ publicKey: "pk_test_ok", transactionId: "order 1", checkoutUrl: "https://checkout.tsara.ng/pay" });
    const url = new URL(checkoutFrame().src);
    expect(url.searchParams.get("trx_id")).toBe("order 1");
    expect(url.searchParams.get("tsara_sdk")).toBe("checkout-js");
    expect(url.searchParams.get("parent_origin")).toBe(window.location.origin);
  });

  it("ships mobile and reduced-motion rules", () => {
    open({ publicKey: "pk_test_ok", transactionId: "order_1" });
    const css = document.querySelector("[data-tsara-checkout-style]")?.textContent ?? "";
    expect(css).toContain("@media(max-width:640px)");
    expect(css).toContain("prefers-reduced-motion:reduce");
  });
});
