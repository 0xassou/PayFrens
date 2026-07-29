"use client";

import {OnchainKitProvider} from "@coinbase/onchainkit";
import {ThemeProvider} from "@/components/theme/theme-provider";
import {ACTIVE_CHAIN} from "@/lib/chains";
import {APP_NAME, ONCHAINKIT_API_KEY} from "@/lib/env";

/**
 * `OnchainKitProvider` is the single entry point in OnchainKit v1: it mounts
 * wagmi, react-query and MiniKit itself, so adding our own WagmiProvider here
 * would give the app two competing wallet connections. MiniKit is switched on
 * through the `miniKit` prop rather than by nesting `MiniKitProvider`.
 */
export function Providers({children}: {children: React.ReactNode}) {
  return (
    <OnchainKitProvider
      apiKey={ONCHAINKIT_API_KEY}
      chain={ACTIVE_CHAIN}
      miniKit={{
        enabled: true,
        // Where `useNotification` posts. Our route signs and forwards to the
        // token URL Base App handed us at add-time.
        notificationProxyUrl: "/api/notify",
        // Inside Base App the wallet is the user's Base App wallet; connecting
        // to it automatically is what makes "one tap to pay" one tap.
        autoConnect: true,
      }}
      config={{
        appearance: {
          name: APP_NAME,
          logo: "/icon.png",
          // Our design tokens own the app's colour. "auto" only stops
          // OnchainKit's own surfaces from clashing with the active theme.
          mode: "auto",
        },
      }}
    >
      <ThemeProvider>{children}</ThemeProvider>
    </OnchainKitProvider>
  );
}
