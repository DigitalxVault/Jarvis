import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  callbacks: {
    session({ session, token }) {
      // Expose the user's sub (Google ID) as session.user.id
      if (token.sub) {
        session.user.id = token.sub
      }
      return session
    },
  },
})
