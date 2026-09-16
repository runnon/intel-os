import Anthropic from '@anthropic-ai/sdk';
import { AnthropicBedrock } from '@anthropic-ai/bedrock-sdk';

/**
 * Model backend selection. Default is Amazon Bedrock (AWS credits) with
 * us.anthropic.claude-sonnet-4-6 — the newest Claude this account is entitled
 * to invoke. Set MODEL_BACKEND=anthropic (+ ANTHROPIC_API_KEY) to use the
 * Claude API directly, or override MODEL_ID for a different entitled model.
 * BEDROCK_AWS_* names exist because some hosts (Vercel) reserve AWS_*.
 */
export function makeModel(): { client: Anthropic | AnthropicBedrock; model: string } {
  const backend = process.env.MODEL_BACKEND ?? 'bedrock';
  if (backend === 'anthropic') {
    return { client: new Anthropic(), model: process.env.MODEL_ID ?? 'claude-opus-4-8' };
  }
  const awsRegion = process.env.BEDROCK_AWS_REGION ?? process.env.AWS_REGION ?? 'us-east-1';
  const accessKey = process.env.BEDROCK_AWS_ACCESS_KEY_ID;
  const secretKey = process.env.BEDROCK_AWS_SECRET_ACCESS_KEY;
  const client =
    accessKey && secretKey
      ? new AnthropicBedrock({ awsRegion, awsAccessKey: accessKey, awsSecretKey: secretKey })
      : new AnthropicBedrock({ awsRegion }); // default AWS credential chain

  return { client, model: process.env.MODEL_ID ?? 'us.anthropic.claude-sonnet-4-6' };
}
