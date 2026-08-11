# Frontend features

This directory owns bounded user workflows. A feature may use public engine contracts, safe platform
adapters, localization, and product UI. It must not import another feature's internal files. Shared
reads belong in an approved public composition contract, not in a hidden cross-feature dependency.
