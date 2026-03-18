type MessageLinkOptions = {
  userId?: string;
  userName?: string;
  userEmail?: string;
  context?: string;
  contextId?: string;
  contextLabel?: string;
  prefill?: string;
};

export function buildMessagesHref(options: MessageLinkOptions = {}): string {
  const params = new URLSearchParams();

  if (options.userId) params.set("dmUserId", options.userId);
  if (options.userName) params.set("dmName", options.userName);
  if (options.userEmail) params.set("dmEmail", options.userEmail);
  if (options.context) params.set("context", options.context);
  if (options.contextId) params.set("contextId", options.contextId);
  if (options.contextLabel) params.set("contextLabel", options.contextLabel);
  if (options.prefill) params.set("prefill", options.prefill);

  const query = params.toString();
  return query ? `/dashboard/messages?${query}` : "/dashboard/messages";
}