import { lazy, Suspense } from "react";
import { Navigate, useRoutes } from "react-router-dom";

import { PageSkeleton } from "@/shared/ui/PageSkeleton";

const HomeCategoriesPage = lazy(() => import("@/pages/HomeCategories/HomeCategories"));
const CategoryBooksPage = lazy(() => import("@/pages/CategoryBooks/CategoryBooks"));
const BookPage = lazy(() => import("@/pages/BookPage/BookPage"));
const TopBooksPage = lazy(() => import("@/pages/TopBooks/TopBooks"));
const MyAccountPage = lazy(() => import("@/pages/MyAccount/MyAccount"));
const ProposalDetailsPage = lazy(() => import("@/pages/ProposalDetails/ProposalDetails"));

export function AppRouter(): JSX.Element {
  const element = useRoutes([
    { path: "/", element: <HomeCategoriesPage /> },
    { path: "/top/:type", element: <TopBooksPage /> },
    { path: "/category/:id", element: <CategoryBooksPage /> },
    { path: "/account", element: <MyAccountPage /> },
    { path: "/proposals/:id", element: <ProposalDetailsPage /> },
    { path: "/book/:id", element: <BookPage /> },
    { path: "*", element: <Navigate to="/" replace /> },
  ]);

  return <Suspense fallback={<PageSkeleton />}>{element}</Suspense>;
}
