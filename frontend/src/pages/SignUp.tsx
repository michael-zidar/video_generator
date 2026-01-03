import { SignUp } from '@clerk/clerk-react'

export function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/login"
        afterSignUpUrl="/dashboard"
      />
    </div>
  )
}
