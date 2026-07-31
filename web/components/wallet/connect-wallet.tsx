"use client";

import {useState} from "react";
import {useConnect} from "wagmi";
import {Button, type ButtonProps} from "@/components/ui/button";
import {WalletModal} from "@/components/wallet/wallet-modal";

/**
 * The primary way in for anyone who opened PayFrens outside Base App, where
 * nothing auto-connects.
 *
 * The button itself never picks a wallet — it opens the picker and lets the
 * user choose. Earlier versions either connected straight to `connectors[0]`
 * (silently deciding for people who had a wallet they preferred) or spilled the
 * whole connector list inline underneath the CTA, which grew with every
 * extension installed.
 */
export function ConnectWallet({
  size = "lg",
  fullWidth = true,
  variant = "primary",
  label = "Connect Wallet",
  className,
}: {
  size?: ButtonProps["size"];
  fullWidth?: boolean;
  variant?: ButtonProps["variant"];
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const {isPending} = useConnect();

  return (
    <>
      <Button
        variant={variant}
        size={size}
        fullWidth={fullWidth}
        className={className}
        // Keeps the CTA showing progress while the wallet's own popup is up and
        // the modal has been dismissed behind it.
        loading={isPending}
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>

      <WalletModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
