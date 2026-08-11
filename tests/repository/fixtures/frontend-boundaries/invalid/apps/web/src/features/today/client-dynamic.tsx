"use client";

export async function loadServerContext() {
  return import("../../server/context");
}
