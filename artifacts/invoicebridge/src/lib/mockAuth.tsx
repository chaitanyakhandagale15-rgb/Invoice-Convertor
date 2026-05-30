import { createContext, useContext, ReactNode } from "react";

const MockUserContext = createContext({
  user: {
    id: "mock-user-123",
    fullName: "Development User",
    primaryEmailAddress: { emailAddress: "dev@local.host" },
    imageUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=dev`,
  },
  isLoaded: true,
  isSignedIn: true,
});

export function MockClerkProvider({ children }: { children: ReactNode }) {
  return (
    <MockUserContext.Provider value={useContext(MockUserContext)}>
      {children}
    </MockUserContext.Provider>
  );
}

export function useUser() {
  return useContext(MockUserContext);
}

export function useClerk() {
  return {
    signOut: () => {
      console.log("Mock sign out");
      window.location.href = "/sign-in";
    },
    addListener: () => () => {},
  };
}

export function Show({ children, when }: { children: ReactNode; when: "signed-in" | "signed-out" }) {
  if (when === "signed-in") return <>{children}</>;
  return null;
}

export function SignIn() {
  return <div>Authentication bypassed for local development</div>;
}

export function SignUp() {
  return <div>Authentication bypassed for local development</div>;
}
