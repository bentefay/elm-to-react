nixpkgsSource:
let
  nixpkgs = import nixpkgsSource {
    config.allowUnfree = true;
    overlays = import ./overlays;
  };
in
with (nixpkgs); stdenv.mkDerivation rec {
  name = "env";

  env = buildEnv {
    name = name;
    paths = buildInputs;
  };

  buildInputs = [
    niv
    nixpkgs-fmt
    nodejs_23
    yarn
  ] ++ lib.optionals stdenv.isLinux [
    glibcLocales
    dvc-with-remotes
  ];
}
