// Shared vi.mock factories for Next.js modules (vi.mock calls themselves must live in each test file).
import { router } from "./ui";

export const navigationMock = () => ({ useRouter: () => router, usePathname: () => "/" });

export const linkMock = () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
});

export const dynamicMock = () => ({ default: () => () => null });
