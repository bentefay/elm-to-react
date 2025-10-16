[
  (self: super: { dotnet = super.callPackage ./dotnet { }; })
  (self: super: { lamdera = super.callPackage ./lamdera { }; })
]
