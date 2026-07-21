import { supabase } from "../db/client.js";
import { invalidateFlowCache } from "./repository.js";
import type { FlowStep } from "./types.js";

export async function listFlows(tenantId: string) {
    const { data, error } = await supabase
        .from("tenant_flows")
        .select(
            "id, name, trigger_type, trigger_keywords, steps, priority, enabled"
        )
        .eq("tenant_id", tenantId)
        .order("priority", { ascending: true });

    if (error) throw error;
    return data ?? [];
}

export async function upsertFlow(
    tenantId: string,
    flow: {
        id?: string;
        name: string;
        triggerType: "keyword" | "default";
        triggerKeywords: string[] | null;
        steps: FlowStep[];
        priority?: number;
        enabled?: boolean;
    }
) {
    const { data, error } = await supabase
        .from("tenant_flows")
        .upsert(
            {
                id: flow.id,
                tenant_id: tenantId,
                name: flow.name,
                trigger_type: flow.triggerType,
                trigger_keywords: flow.triggerKeywords,
                steps: flow.steps,
                priority: flow.priority ?? 0,
                enabled: flow.enabled ?? true
            },
            { onConflict: "tenant_id,name" }
        )
        .select(
            "id, name, trigger_type, trigger_keywords, steps, priority, enabled"
        )
        .single();

    if (error) throw error;
    invalidateFlowCache(tenantId);
    return data;
}

export async function deleteFlow(tenantId: string, flowId: string) {
    const { error } = await supabase
        .from("tenant_flows")
        .delete()
        .eq("tenant_id", tenantId)
        .eq("id", flowId);

    if (error) throw error;
    invalidateFlowCache(tenantId);
}

export async function listTemplates(tenantId: string) {
    const { data, error } = await supabase
        .from("tenant_templates")
        .select("id, name, body, quick_replies")
        .eq("tenant_id", tenantId)
        .order("name", { ascending: true });

    if (error) throw error;
    return data ?? [];
}

export async function upsertTemplate(
    tenantId: string,
    template: {
        id?: string;
        name: string;
        body: string;
        quickReplies: { id: string; title: string }[];
    }
) {
    if (template.quickReplies.length > 3) {
        throw new Error("A template can have at most 3 quick replies");
    }

    const { data, error } = await supabase
        .from("tenant_templates")
        .upsert(
            {
                id: template.id,
                tenant_id: tenantId,
                name: template.name,
                body: template.body,
                quick_replies: template.quickReplies
            },
            { onConflict: "tenant_id,name" }
        )
        .select("id, name, body, quick_replies")
        .single();

    if (error) throw error;
    invalidateFlowCache(tenantId);
    return data;
}

export async function deleteTemplate(tenantId: string, templateId: string) {
    const { error } = await supabase
        .from("tenant_templates")
        .delete()
        .eq("tenant_id", tenantId)
        .eq("id", templateId);

    if (error) throw error;
    invalidateFlowCache(tenantId);
}
