// One toast host lives in the Layout; anything can raise a message without prop drilling.
export const TOAST_EVENT = 'erp:toast';

export const showError = (message) =>
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: String(message || 'Something went wrong.') }));
