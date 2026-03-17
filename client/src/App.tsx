import { Suspense, type ReactElement } from 'react';
import { Spin } from 'antd';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute, PublicOnlyRoute } from './router/guards';
import { appRoutes } from './router/routes';

function App() {
  const renderRouteElement = (
    element: ReactElement,
    options: { requiresAuth?: boolean; guestOnly?: boolean; requiredPermissions?: string[] },
  ) => {
    const { requiresAuth, guestOnly, requiredPermissions = [] } = options;

    if (guestOnly) {
      return <PublicOnlyRoute>{element}</PublicOnlyRoute>;
    }

    if (requiresAuth) {
      return (
        <ProtectedRoute requiredPermissions={requiredPermissions}>
          {element}
        </ProtectedRoute>
      );
    }

    return element;
  };

  return (
    <BrowserRouter>
      <Suspense
        fallback={
          <div
            style={{
              minHeight: '100vh',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Spin size="large" />
          </div>
        }
      >
        <Routes>
          {appRoutes.map((route) => (
            <Route
              key={route.path}
              path={route.path}
              element={renderRouteElement(route.element, {
                requiresAuth: route.requiresAuth,
                guestOnly: route.guestOnly,
                requiredPermissions: route.requiredPermissions,
              })}
            />
          ))}
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
