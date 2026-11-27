cmake_minimum_required(VERSION 3.22)
project(finito_secp256k1 C)

include(FetchContent)

# Bitcoin Core's libsecp256k1, fetched by its release tarball's hash, built
# static into the JNI library below with what Finito calls and nothing more:
# no optional modules, and small precomputed tables. The verification table
# (ECMULT_WINDOW_SIZE), 1 MB at its default, serves only the signature checks
# Finito never makes through it; key generation keeps a 22 KiB table.
set(BUILD_SHARED_LIBS OFF)
set(SECP256K1_ECMULT_WINDOW_SIZE 2 CACHE STRING "" FORCE)
set(SECP256K1_ECMULT_GEN_KB 22 CACHE STRING "" FORCE)
set(SECP256K1_INSTALL OFF CACHE BOOL "" FORCE)
set(SECP256K1_BUILD_BENCHMARK OFF CACHE BOOL "" FORCE)
set(SECP256K1_BUILD_TESTS OFF CACHE BOOL "" FORCE)
set(SECP256K1_BUILD_EXHAUSTIVE_TESTS OFF CACHE BOOL "" FORCE)
set(SECP256K1_BUILD_CTIME_TESTS OFF CACHE BOOL "" FORCE)
foreach(module ECDH RECOVERY EXTRAKEYS SCHNORRSIG MUSIG ELLSWIFT SILENTPAYMENTS)
  set(SECP256K1_ENABLE_MODULE_${module} OFF CACHE BOOL "" FORCE)
endforeach()

FetchContent_Declare(
  secp256k1
  URL https://github.com/bitcoin-core/secp256k1/archive/refs/tags/v0.8.0.tar.gz
  URL_HASH SHA256=eb52b0e9239dff7dc26be5f9623567141b8720ec47da29eb3c1e0a660d17c8bb
)
FetchContent_MakeAvailable(secp256k1)

add_library(finito_secp256k1 SHARED src/main/cpp/finito-secp256k1.c)
target_link_libraries(finito_secp256k1 PRIVATE secp256k1)
target_compile_options(finito_secp256k1 PRIVATE -O2 -fvisibility=hidden)
target_link_options(finito_secp256k1 PRIVATE -Wl,--exclude-libs,ALL)
