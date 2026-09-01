import { apiRegistry, AppApiRegistry } from './registry';
import { EndpointDefinition } from './types';

// Flatten the nested apiRegistry (domain -> action -> EndpointDefinition)
// into a single channel -> EndpointDefinition map, built once from the same
// registry that defines AppApiRegistry - so it can never drift from it.
const endpointsByChannel = Object.values(apiRegistry).reduce<
  Record<string, EndpointDefinition>
>((acc, domainEndpoints) => {
  Object.values(domainEndpoints).forEach((endpoint) => {
    acc[endpoint.channel] = endpoint;
  });
  return acc;
}, {});

export const validChannels: Record<keyof AppApiRegistry, true> = Object.keys(
  endpointsByChannel
).reduce(
  (acc, channel) => {
    acc[channel as keyof AppApiRegistry] = true;
    return acc;
  },
  {} as Record<keyof AppApiRegistry, true>
);

// Type guard to check if a channel exists in the registry
export function isValidChannel(channel: string): channel is keyof AppApiRegistry {
  return channel in validChannels;
}

// Look up the zod schemas for a channel, e.g. to validate a payload at
// runtime (electron-app's IPC handler registration) or on the client before
// it is sent.
export function getEndpointSchemas(
  channel: string
): EndpointDefinition | undefined {
  return endpointsByChannel[channel];
}
