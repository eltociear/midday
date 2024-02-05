"use server";

import { action } from "@/actions/safe-action";
import { createEntriesSchema } from "@/actions/schema";
import { getUser } from "@midday/supabase/cached-queries";
import { createProject } from "@midday/supabase/mutations";
import { createClient } from "@midday/supabase/server";
import { revalidateTag } from "next/cache";

export const createEntriesAction = action(
  createEntriesSchema,
  async (params) => {
    const supabase = createClient();
    const user = await getUser();

    const entries = params.map((entry) => ({
      ...entry,
      team_id: user.data.team_id,
    }));

    const { data, error } = await supabase
      .from("tracker_entries")
      .insert(entries);

    console.log(data, error);

    revalidateTag(`tracker_projects_${user.data.team_id}`);

    return data;
  }
);