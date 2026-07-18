"use client";

import type { Project } from "@evaluation/contracts";
import type { Catalog, Locale } from "@evaluation/localization";
import { createElement, useCallback, useEffect, useState } from "react";

import {
  ProjectDetailView,
  ProjectListView,
  type ProjectScreenView,
  WorkstreamDetailView,
  type WorkstreamScreenView,
} from "./workspace-views";

type WorkspaceClientProperties =
  | {
      readonly catalog: Catalog;
      readonly locale: Locale;
      readonly mode: "list";
    }
  | {
      readonly catalog: Catalog;
      readonly locale: Locale;
      readonly mode: "project";
      readonly projectId: string;
    }
  | {
      readonly catalog: Catalog;
      readonly locale: Locale;
      readonly mode: "workstream";
      readonly projectId: string;
      readonly workstreamId: string;
    };

type LoadState =
  | { readonly kind: "loading" }
  | { readonly kind: "error"; readonly messageKey: string; readonly correlationId?: string }
  | {
      readonly kind: "list";
      readonly projects: readonly Project[];
      readonly ownersById: Readonly<Record<string, string>>;
    }
  | { readonly kind: "project"; readonly screen: ProjectScreenView }
  | { readonly kind: "workstream"; readonly screen: WorkstreamScreenView };

export function WorkspaceClient(properties: WorkspaceClientProperties) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const path =
    properties.mode === "list"
      ? "/api/workspace/projects"
      : properties.mode === "project"
        ? `/api/workspace/projects/${properties.projectId}`
        : `/api/workspace/projects/${properties.projectId}/workstreams/${properties.workstreamId}`;

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setState({ kind: "loading" });
      try {
        const response = await fetch(path, {
          cache: "no-store",
          credentials: "same-origin",
          method: "GET",
          ...(signal === undefined ? {} : { signal }),
        });
        const body: unknown = await response.json();
        if (!response.ok) {
          const safeError = asSafeError(body);
          setState({
            kind: "error",
            messageKey: safeError.messageKey,
            ...(safeError.correlationId === undefined
              ? {}
              : { correlationId: safeError.correlationId }),
          });
          return;
        }
        if (properties.mode === "list") {
          const projects = body as readonly Project[];
          const ownersById = await loadOwnerNames(projects, signal);
          setState({ kind: "list", ownersById, projects });
        } else if (properties.mode === "project") {
          setState({ kind: "project", screen: body as ProjectScreenView });
        } else {
          setState({ kind: "workstream", screen: body as WorkstreamScreenView });
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({ kind: "error", messageKey: "errors.internal" });
      }
    },
    [path, properties.mode],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  if (state.kind === "loading") {
    return (
      <p className="workspaceState" role="status">
        {properties.catalog["workspace.loading"]}
      </p>
    );
  }
  if (state.kind === "error") {
    const message =
      properties.catalog[state.messageKey as keyof Catalog] ??
      properties.catalog["errors.internal"];
    return (
      <section className="workspaceState panel" role="alert">
        <p>{message}</p>
        {state.correlationId === undefined ? null : (
          <p>
            {properties.catalog["workspace.errorReference"].replace(
              "{reference}",
              state.correlationId,
            )}
          </p>
        )}
        <button type="button" onClick={() => void load()}>
          {properties.catalog["actions.retry"]}
        </button>
      </section>
    );
  }
  if (state.kind === "list") {
    return createElement(ProjectListView, {
      catalog: properties.catalog,
      locale: properties.locale,
      ownersById: state.ownersById,
      projects: state.projects,
    });
  }
  if (state.kind === "project") {
    return createElement(ProjectDetailView, {
      catalog: properties.catalog,
      locale: properties.locale,
      onMutationSuccess: load,
      screen: state.screen,
    });
  }
  if (properties.mode !== "workstream") return null;
  return createElement(WorkstreamDetailView, {
    catalog: properties.catalog,
    locale: properties.locale,
    onMutationSuccess: load,
    projectId: properties.projectId,
    screen: state.screen,
    workstreamId: properties.workstreamId,
  });
}

async function loadOwnerNames(
  projects: readonly Project[],
  signal?: AbortSignal,
): Promise<Readonly<Record<string, string>>> {
  const entries = await Promise.all(
    projects.map(async (project): Promise<readonly [string, string] | null> => {
      if (project.primaryOwnerId === null) return null;
      try {
        const response = await fetch(`/api/workspace/projects/${project.id}`, {
          cache: "no-store",
          credentials: "same-origin",
          method: "GET",
          ...(signal === undefined ? {} : { signal }),
        });
        if (!response.ok) return null;
        const body = (await response.json()) as Partial<ProjectScreenView>;
        const owner = body.workspace?.people.find(
          (period) => period.person.id === project.primaryOwnerId,
        );
        return owner === undefined ? null : [project.primaryOwnerId, owner.person.displayName];
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") throw error;
        return null;
      }
    }),
  );
  return Object.fromEntries(
    entries.filter((entry): entry is readonly [string, string] => entry !== null),
  );
}

function asSafeError(value: unknown): { messageKey: string; correlationId?: string } {
  if (typeof value !== "object" || value === null) return { messageKey: "errors.internal" };
  const candidate = value as { messageKey?: unknown; correlationId?: unknown };
  return {
    messageKey: typeof candidate.messageKey === "string" ? candidate.messageKey : "errors.internal",
    ...(typeof candidate.correlationId === "string"
      ? { correlationId: candidate.correlationId }
      : {}),
  };
}
