"use client";
import { createContext, useContext } from "react";

type Ctx = {
  collapsed: boolean;
  toggle: () => void;
};

export const SidebarCollapsedContext = createContext<Ctx>({
  collapsed: false,
  toggle: () => {},
});

export const useSidebarCollapsed = () => useContext(SidebarCollapsedContext).collapsed;
export const useSidebarToggle = () => useContext(SidebarCollapsedContext).toggle;
