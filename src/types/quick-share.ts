export type QuickShareExpiry = "1h" | "1d" | "7d" | "30d" | "never";

export type CreateQuickShareInput = {
  title: string;
  markdown: string;
  expiry: QuickShareExpiry;
};

export type QuickSharePayload = {
  publicId: string;
  title: string;
  markdown: string;
  createdAt: string;
  expiresAt: string | null;
};

export type CreateQuickShareResult = QuickSharePayload & {
  url: string;
  managementToken: string;
};
