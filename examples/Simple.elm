module Main exposing (main)

import Html exposing (Html, text)


type Msg
    = Increment
    | Decrement


type alias Model =
    { count : Int
    }


init : Model
init =
    { count = 0
    }


update : Msg -> Model -> Model
update msg model =
    case msg of
        Increment ->
            { model | count = model.count + 1 }

        Decrement ->
            { model | count = model.count - 1 }


view : Model -> Html Msg
view model =
    Html.div []
        [ Html.text ("Count: " ++ String.fromInt model.count)
        ]


main : Html Msg
main =
    view init
