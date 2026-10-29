import { z } from "zod";
import { browserOwner } from "@/features/connections/server/browser-session";
import { services } from "@/server/container";
import { errorResponse, jsonBody, requireSameOrigin } from "@/server/http";
import { AppError } from "@/lib/errors";
import { runWithRequestOwner } from "@/server/request-context";
import { piModels } from "@/features/connections/server/runtime/models";
import { readSettings, writeSettings } from "@/features/settings/server/settings-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const command = z.discriminatedUnion("action", [
  z.object({ action: z.literal("connect") }), z.object({ action: z.literal("disconnect") }),
  z.object({ action: z.literal("poll"), attemptId: z.string().min(1).max(64) }),
  z.object({ action: z.literal("refresh-models") }),
  z.object({ action: z.literal("select-model"), modelId: z.string().min(1).max(200) }),
  z.object({ action: z.literal("background-use"), enabled: z.enum(["true", "false"]) }),
]);
export async function GET() {
  try { return Response.json(services().connections.status(await browserOwner()), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return errorResponse(error); }
}
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const parsed = command.safeParse(await jsonBody(request));
    if (!parsed.success) throw new AppError("invalid_command", "Choose a valid connection action.");
    const owner = await browserOwner(); const connection = services().connections; const action = parsed.data;
    if (action.action === "select-model" && !piModels().getModel("xai", action.modelId)) {
      throw new AppError("model_unavailable", "This Grok model is not supported by the tutoring runtime.");
    }
    let result = action.action === "connect" ? await connection.begin(owner)
      : action.action === "disconnect" ? await connection.disconnect(owner)
      : action.action === "poll" ? await connection.poll(owner, action.attemptId)
      : action.action === "refresh-models" ? await connection.refreshModels(owner)
      : action.action === "background-use" ? connection.setBackgroundUse(owner, action.enabled === "true")
      : connection.selectModel(owner, action.modelId);
    if (result.phase === "connected" && result.selectedModel && !piModels().getModel("xai", result.selectedModel)) {
      const supported = result.models.find(model => piModels().getModel("xai", model.id));
      if (supported) result = connection.selectModel(owner, supported.id);
    }
    if (result.phase === "connected" && result.selectedModel) runWithRequestOwner(owner, () => {
      const model = piModels().getModel("xai", result.selectedModel!);
      if (!model) return;
      const settings = readSettings();
      if (action.action === "select-model") {
        writeSettings({ ...settings, models: { ...settings?.models, strong: { model: { provider: "xai", id: model.id } } } });
      } else if (!settings?.models?.strong?.model) {
        const pin = { model: { provider: "xai", id: model.id } };
        writeSettings({ ...settings, models: {
          ...settings?.models,
          strong: pin,
          cheap: settings?.models?.cheap ?? pin,
          ...(settings?.models?.vision ? {} : model.input.includes("image") ? { vision: pin } : {}),
        } });
      }
    });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
