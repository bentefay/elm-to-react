nixpkgsSource:
let
  nixpkgs = import nixpkgsSource {
    config.allowUnfree = true;
    overlays = import ./overlays;
  };
in
with (nixpkgs); stdenv.mkDerivation rec {
  name = "elm-to-react-env";

  shellEnv = buildEnv {
    name = name;
    paths = buildInputs;
  };

  buildInputs = [
    niv
    nixpkgs-fmt
    nodejs_24
    yarn
  ] ++ lib.optionals stdenv.isLinux [
    glibcLocales
  ];
}
