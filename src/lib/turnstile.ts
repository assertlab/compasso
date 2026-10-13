/** Action name the widget declares and the server expects, so a token minted for another action cannot be replayed here. */
export const TURNSTILE_ACTION = "send-code";

/** Header Better Auth's captcha plugin reads the token from. */
export const TURNSTILE_HEADER = "x-captcha-response";
