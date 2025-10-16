# Inspired by https://github.com/NixOS/nixpkgs/blob/master/pkgs/development/compilers/dotnet
# To update:
# 1. Go to page for the desired major version on dotnet.microsoft.com e.g.: https://dotnet.microsoft.com/download/dotnet/7.0
# 2. Update the version of the SDK specified below
# 3. In the SDK > binaries column, choose the relevant binaries (Linux x64/Arm64 and macOS x64/Arm64)
# 4. Copy and paste the Checksum (SHA512) below
{ stdenv, buildEnv, fetchurl, lib }:
let
  downloadUrl = version: os: arch:
    "https://dotnetcli.azureedge.net/dotnet/Sdk/${version}/dotnet-sdk-${version}-${os}-${arch}.tar.gz";

  sha = version: os: arch: {
    "9.0.301" = {
      osx = {
        arm64 =
          "36f1aeb7aff2aac117919f57abad725c89dacb879a3c3b8d41b01575602ceb2d5cad805d3c6d67a0fda0208b2477d0d58668c133215392ee65bf88586571e43c";
        x64 =
          "5bba401f9b6450c0ee51ddc3943c79ab92ed9188e1d4208001ff97af79b2fb51db92435548c47fe943f69fa3c2e88ef8e9408c7821a59d8432b843797777065c";
      };
      linux = {
        arm64 =
          "24e2329c40cf3e42cd1e8753d88fce454bc4a9abbad2b01e80f33130a801123a531e227673d381cb9710b715805f188fe0dcb9833fb7d04dab2cd937a1f480ed";
        x64 =
          "7415a264843d3df78bd57fb2f17074e811e0b193976a45b4d6778d3ebb9266854c4e037c3cdf4b534de7b8c64799b0e58dce9fac6f3f3c6cacb3295555d31d4f";
      };
    };
    "7.0.403" = {
      osx = {
        arm64 =
          "6083b9f469dccf097a6a1bd4a264ab5438bce653ceceb54cfba25526845783e43e57e6b57eb6c7b4157108d9572ca62d8df2ecdbc1a0a36d9f08310b9bb3c9a1";
        x64 =
          "50a38d89af656ac5a3110761182c1b8b6ca15821eb4fde8d0eaebb6dfbeb4c9046a80c00004cdbdb4e5165c6cca1f2c6ef0ca5ff84fc9c32b4c298a9f620bac6";
      };
      linux = {
        arm64 =
          "0980f3f888f1267a5dee5c916ae8d0931f0c6789f1e7334fb7b4d5ab27a1876ec014d30be8977d314e4aa7302b197dde09ed39cdc5ed84b366307148d5350deb";
        x64 =
          "2e96fa4ee32885a4433be12aac0e10998f9e7f0fe4791f33cd31966c0e0d345d978514787a36c5f0f43c7754e9639a5d52fc96c9f44cf56c0cfc9a8ad2620dd6";
      };
    };
  }."${version}"."${os}"."${arch}";

  platformSetForVersion = version: {
    x86_64-linux =
      let
        os = "linux";
        arch = "x64";
      in
      {
        src = fetchurl {
          url = downloadUrl version os arch;
          sha512 = sha version os arch;
        };
      };
    x86_64-darwin =
      let
        os = "osx";
        arch = "x64";
      in
      {
        src = fetchurl {
          url = downloadUrl version os arch;
          sha512 = sha version os arch;
        };
      };
    aarch64-linux =
      let
        os = "linux";
        arch = "arm64";
      in
      {
        src = fetchurl {
          url = downloadUrl version os arch;
          sha512 = sha version os arch;
        };
      };
    aarch64-darwin =
      let
        os = "osx";
        arch = "arm64";
      in
      {
        src = fetchurl {
          url = downloadUrl version os arch;
          sha512 = sha version os arch;
        };
      };
  };

  mkDerivation = version:
    let
      platformsForVersion = platformSetForVersion version;
    in
    stdenv.mkDerivation (
      platformsForVersion."${builtins.currentSystem}" // {
        name = "dotnet-sdk-${version}";
        version = version;

        sourceRoot = ".";

        dontPatchELF = true;

        noDumpEnvVars = true;

        installPhase =
          ''
            runHook preInstall
            mkdir -p $out/bin
            cp -r ./ $out
            ln -s $out/dotnet $out/bin/dotnet
            runHook postInstall
          '';

        meta = with lib; {
          homepage = "https://dotnet.github.io/";
          description = ".NET SDK";
          platforms = builtins.attrNames platformsForVersion;
          license = licenses.mit;
        };
      }
    );

  combineVersions = dotnetDerivations:
    let
      main = builtins.head dotnetDerivations;
    in
    buildEnv {
      name = "dotnet-core";
      paths = dotnetDerivations;
      pathsToLink = [ "/host" "/packs" "/sdk" "/shared" "/templates" ];
      ignoreCollisions = true;
      postBuild = ''
        cp ${main}/dotnet $out/dotnet
        mkdir $out/bin
        ln -s $out/dotnet $out/bin/
      '';
    };
in
combineVersions (builtins.map mkDerivation [ "7.0.403" "9.0.301" ])
