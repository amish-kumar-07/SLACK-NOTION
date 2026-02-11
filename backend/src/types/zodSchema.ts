import z, { email } from "zod";


export const SignupSchema = z.object({
    name: z.string().min(3),
    email: z.string().email(),
    password: z.string().min(6),
    role: z.enum(["admin", "user"])
});

export const LoginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6)
});

export const WorkspaceSchema = z.object({
    workspaceName : z.string(),
    description : z.string()
})

// ✅ CORRECT
export const InviteUser = z.object({
  email: z.string().email(),
  invitedById: z.string(),      // Validates UUID format
  invitedByEmail: z.string().email(),
  workspaceId: z.string(),     // Validates UUID format
  role : z.enum(["admin","member"]).default("member")
});

export const GetAllInvite = z.object({
    email : z.string().email()
});

export const AcceptInvite = z.object({
    id : z.string(), 
    workspaceId : z.string(),
    role : z.enum(["admin","member"]).default("member")
});