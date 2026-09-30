import { useRef } from "react";
import { open, type CheckoutController } from "@tsara/checkout-js";

export function TsaraPayButton({ transactionId }: { transactionId: string }) {
  const checkout = useRef<CheckoutController | null>(null);

  return (
    <button
      type="button"
      onClick={() => {
        checkout.current = open({
          publicKey: import.meta.env.VITE_TSARA_PUBLIC_KEY,
          transactionId,
          onSuccess: result => console.log("Payment completed", result),
          onError: error => console.error(error),
        });
      }}
    >
      Pay securely with Tsara
    </button>
  );
}

