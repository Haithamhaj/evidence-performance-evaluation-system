# Web server boundary

This directory owns server-only authenticated readers and composition adapters. Client Components and
`product-ui` cannot import it. Routes may call its public readers but may not reach domain persistence
or Prisma directly. Server authorization remains authoritative even when an action is hidden in UI.
