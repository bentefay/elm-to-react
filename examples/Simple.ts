// Generated from Elm module: Main

// import Html exposing (Html, text)

// type Msg
export type Msg = ["Increment"] | ["Decrement"];

// type alias Model
export type Model = { count: number };

// value init
export const init = { count: 0 };

// function update
export const update = (msg, model) =>
  (() => {
    if (msg[0] === "Increment") return { ...model, count: model.count + 1 };
    if (msg[0] === "Decrement") return { ...model, count: model.count - 1 };
    throw new Error("Non-exhaustive pattern match");
  })();

// function view
export const view = model =>
  Html.div([], [Html.text("Count: " + String.fromInt(model.count))]);

// value main
export const main = view(init);
