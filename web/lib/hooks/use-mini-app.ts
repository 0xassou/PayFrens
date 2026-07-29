"use client";

import {useEffect} from "react";
import {useAddFrame, useMiniKit} from "@coinbase/onchainkit/minikit";

/**
 * Signals to Base App that the mini-app has painted, which dismisses the splash
 * screen. Until this fires the user stares at a logo, so it runs as soon as the
 * first screen mounts rather than after data has loaded.
 */
export function useMiniAppReady() {
  const {isMiniAppReady, setMiniAppReady, context} = useMiniKit();

  useEffect(() => {
    if (!isMiniAppReady) void setMiniAppReady();
  }, [isMiniAppReady, setMiniAppReady]);

  return {
    isReady: isMiniAppReady,
    context,
    /** Farcaster profile of whoever is looking, when we are inside Base App. */
    user: context?.user,
    /** Already added to their apps — so we can stop asking. */
    isAdded: context?.client?.added ?? false,
  };
}

/**
 * Prompts the user to add PayFrens, which is what grants a notification token.
 * Without it "someone paid your split" has nowhere to go.
 *
 * The returned token is registered server-side so notifications can be sent
 * from the backend later, rather than only while the app is open.
 */
export function useEnableNotifications() {
  const addFrame = useAddFrame();
  const {context} = useMiniKit();

  return async () => {
    const result = await addFrame();
    if (!result) return false;

    const fid = context?.user?.fid;
    if (!fid) return false;

    await fetch("/api/notify/register", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({fid, token: result.token, url: result.url}),
    });

    return true;
  };
}
