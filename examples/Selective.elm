module Selective exposing (User, defaultUser, isActive)


type Status
    = Active
    | Inactive


type alias User =
    { name : String
    , status : Status
    }


defaultUser : User
defaultUser =
    { name = "Anonymous"
    , status = Inactive
    }


isActive : User -> Bool
isActive user =
    case user.status of
        Active ->
            True

        Inactive ->
            False


-- This should NOT be exported
privateHelper : String -> String
privateHelper str =
    str ++ "!"
