// Generated from Elm module: Selective

// type Status
type Status = ["Active"] | ["Inactive"];

// type alias User
export type User = { name: string; status: Status };

// value defaultUser
export const defaultUser = { name: "Anonymous", status: Inactive };

// function isActive
export const isActive = user =>
  (() => {
    if (user.status[0] === "Active") return True;
    if (user.status[0] === "Inactive") return False;
    throw new Error("Non-exhaustive pattern match");
  })();

// function privateHelper
const privateHelper = str => str + "!";
