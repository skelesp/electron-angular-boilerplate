import { z } from 'zod';
import { apiRegistry, AppApiEvents, AppApiRegistry, eventRegistry } from './registry';
import { EndpointDefinition, EventDefinition } from './types';

// Flatten the nested apiRegistry (domain -> action -> EndpointDefinition)
// into a single channel -> EndpointDefinition map, built once from the same
// registry that defines AppApiRegistry - so it can never drift from it.
const endpointsByChannel = Object.values(apiRegistry).reduce<Record<string, EndpointDefinition>>(
  (acc, domainEndpoints) => {
    Object.values(domainEndpoints).forEach((endpoint) => {
      acc[endpoint.channel] = endpoint;
    });
    return acc;
  },
  {}
);

// Same flattening for the event registry, and for the same reason.
const eventsByChannel = Object.values(eventRegistry).reduce<Record<string, EventDefinition>>((acc, domainEvents) => {
  Object.values(domainEvents).forEach((event) => {
    acc[event.channel] = event;
  });
  return acc;
}, {});

export const validChannels: Record<keyof AppApiRegistry, true> = Object.keys(endpointsByChannel).reduce(
  (acc, channel) => {
    acc[channel as keyof AppApiRegistry] = true;
    return acc;
  },
  {} as Record<keyof AppApiRegistry, true>
);

export const validEventChannels: Record<keyof AppApiEvents, true> = Object.keys(eventsByChannel).reduce(
  (acc, channel) => {
    acc[channel as keyof AppApiEvents] = true;
    return acc;
  },
  {} as Record<keyof AppApiEvents, true>
);

// Type guard to check if a channel exists in the registry
export function isValidChannel(channel: string): channel is keyof AppApiRegistry {
  return channel in validChannels;
}

// The event-channel counterpart, used by preload.ts to refuse a renderer subscribing to
// an arbitrary IPC channel - the same narrowing `isValidChannel` gives `invoke`.
export function isValidEventChannel(channel: string): channel is keyof AppApiEvents {
  return channel in validEventChannels;
}

// Look up the zod schemas for a channel, e.g. to validate a payload at
// runtime (electron-app's IPC handler registration) or on the client before
// it is sent.
export function getEndpointSchemas(channel: string): EndpointDefinition | undefined {
  return endpointsByChannel[channel];
}

// Look up the payload schema for an event channel, so the main process can validate what
// it is about to push before any renderer sees it.
export function getEventSchema(channel: string): z.ZodType | undefined {
  return eventsByChannel[channel]?.payloadSchema;
}
