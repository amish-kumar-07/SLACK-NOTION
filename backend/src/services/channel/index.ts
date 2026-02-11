import { eq , and } from "drizzle-orm";
import { db } from "../../db/index.js";
import { Channels } from "../../db/schema.js";

export async function createChannel(workspace_id:string , name : string , created_by : string) {
    try
    {
        const [newChannel] = await db.insert(Channels)
                                     .values({
                                        workspace_id,
                                        name,
                                        created_by
                                     }).returning();
   
        if(!newChannel)
        {
            return null;
        }
        return newChannel;                                  
    }
    catch(err)
    {
        console.log(err);
        return null;
    }
}

export async function getChannel(
  workspace_id: string,
  name: string,
) {
  try {
    const [channel] = await db
      .select()
      .from(Channels)
      .where(
        and(
          eq(Channels.workspace_id, workspace_id),
          eq(Channels.name, name),
        )
      );

    return channel ?? null;
  } catch (err) {
    console.error("Error fetching channel:", err);
    return null;
  }
}

