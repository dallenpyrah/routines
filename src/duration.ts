import { Data, Duration, Effect, Option } from "effect";

export class RoutineDurationError extends Data.TaggedError(
  "RoutineDurationError",
)<{
  readonly label: string;
  readonly input: string;
}> {}

export const parseDuration = (label: string, input: string) =>
  Option.match(Duration.decodeUnknown(input), {
    onNone: () => Effect.fail(new RoutineDurationError({ label, input })),
    onSome: (duration) => Effect.succeed(duration),
  });
