module ExposeAll exposing (..)


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
