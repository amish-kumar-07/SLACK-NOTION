import { db } from "../../db/index.js";
import { wrokspaceTable , WorkspaceMembers } from "../../db/schema.js";
import { eq , and } from "drizzle-orm";

type role = 'admin' | 'member' | 'owner';

export async function createWorkspace(
  userId: string,
  name: string,
  description?: string
) {
  try {
    const [workspace] = await db.insert(wrokspaceTable).values({
        userId : userId,
        WorkspaceName : name,
        Description : description
    }).returning();
    
    if(!workspace)
    {
        return null;
    }

    return workspace;

  } catch (err) {
    console.error(err);
    return null;
  }
}


export async function getWorkspace(userId: string) {
  try {
    const workspaces = await db
      .select({
        id: wrokspaceTable.id,
        WorkspaceName: wrokspaceTable.WorkspaceName,
        Description: wrokspaceTable.Description,
        createdAt: wrokspaceTable.createdAt,
      })
      .from(WorkspaceMembers)
      .innerJoin(
        wrokspaceTable,
        eq(WorkspaceMembers.workspaceId, wrokspaceTable.id)
      )
      .where(eq(WorkspaceMembers.userId, userId));

    return workspaces;
  } catch (err) {
    console.log(err);
    return null;
  }
}


export async function addMember(workspaceId : string , userId : string , role : role)
{
  try
  {
    
    const [newMember] = await db.insert(WorkspaceMembers).values({
      workspaceId,
      userId,
      role : role
    }).returning();
    
    return newMember;
  }
  catch(err)
  {
    console.log(err);
    return null;
  }
}

export async function isWorkspaceMember(
  workspaceId: string,
  userId: string
): Promise<boolean> {
  try {
    const [workspaceMember] = await db
      .select()
      .from(WorkspaceMembers)
      .where(
        and(
          eq(WorkspaceMembers.workspaceId, workspaceId),
          eq(WorkspaceMembers.userId, userId)
        )
      )
      .limit(1);

    return !!workspaceMember;
  } catch (err) {
    console.error(err);
    return false;
  }
}


export async function isValidWorkspace(workspaceId : string , channelId : string , userId : string){
   try
   { 
      setTimeout(()=>{
        console.log("All Okay");
      },100);
      return true;
   }
   catch(err)
   {
     console.log(err);
     return null;
   }
}