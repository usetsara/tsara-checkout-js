# Tsara Checkout JS

Browser-safe SDK for opening Tsara hosted Checkout. It accepts only `pk_test_...` and `pk_live_...` public keys.

## Install

```bash
npm install @tsara/checkout-js
```

The package ships ESM, CommonJS, IIFE, and TypeScript declarations.

## Modal Checkout

```js
import { open } from "@tsara/checkout-js";

const checkout = open({
  publicKey: "pk_test_xxxxx",
  transactionId: "order_001",
  onLoad: () => console.log("Checkout is ready"),
  onSuccess: result => console.log("Payment completed", result),
  onCancel: context => console.log("Checkout closed", context),
  onError: error => console.error(error.message),
});

// Close without reporting a customer cancellation.
checkout.destroy();
```

Only one modal is active at a time. The SDK locks background scrolling, restores focus on close, supports Escape and backdrop dismissal, and uses a full-screen layout on small screens. Set `closeOnBackdrop: false` to disable backdrop dismissal.

## Redirect Checkout

```js
import { redirect } from "@tsara/checkout-js";

redirect({
  publicKey: "pk_live_xxxxx",
  transactionId: "order_001",
});
```

Redirect mode leaves the merchant page. Handle completion through the transaction's success and cancel URLs, then verify the final status server-side.

## Browser script

Use the version-pinned browser build published with the npm package. Pinning the version prevents an SDK update from changing production behavior without a deliberate merchant release.

```html
<script src="https://unpkg.com/@tsara/checkout-js@0.1.0/dist/index.global.js"></script>
<script>
  TsaraCheckout.open({
    publicKey: "pk_test_xxxxx",
    transactionId: "order_001"
  });
</script>
```

## Options

| Option | Required | Description |
| --- | --- | --- |
| `publicKey` | Yes | `pk_test_...` or `pk_live_...` key |
| `transactionId` | Yes | Merchant transaction identifier |
| `checkoutUrl` | No | Alternate hosted Checkout URL for controlled testing |
| `ariaLabel` | No | Accessible dialog and iframe label |
| `styleNonce` | No | CSP nonce applied to injected styles |
| `closeOnBackdrop` | No | Allow backdrop dismissal; defaults to `true` |
| `onLoad` | No | Called when hosted Checkout is ready |
| `onSuccess` | No | Receives `{ transactionId, status, reference? }` |
| `onCancel` | No | Receives `{ transactionId, reason }` |
| `onError` | No | Receives an `Error` |

## Content Security Policy

Allow the hosted Checkout origin in `frame-src` and `connect-src`. Allow the origin serving your SDK script in `script-src`.

```http
Content-Security-Policy: default-src 'self'; script-src 'self'; frame-src https://checkout.tsara.ng; connect-src 'self' https://checkout.tsara.ng; style-src 'self' 'nonce-{RANDOM_NONCE}';
```

Pass the server-generated style nonce with `styleNonce`.

## Security

- Never expose `sk_test_...` or `sk_live_...` in browser code.
- Checkout messages are accepted only from the configured Checkout origin and the iframe created by the SDK.
- Treat callbacks as UI signals, not settlement proof. Verify payment on your server or through signed webhooks.
- Keep `checkoutUrl` fixed in application configuration; never populate it from customer input.

## Browser support

The SDK targets current evergreen versions of Chrome, Edge, Firefox, and Safari, including current mobile Safari and Chrome. It requires `URL`, `postMessage`, and modern DOM APIs.

## Examples

- `examples/index.html`
- `examples/react/TsaraPayButton.tsx`

## Release status

`0.1.x` is the published release-candidate line. Install an exact version for production integrations and review the release notes before upgrading.

