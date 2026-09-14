# PrayogCode C Execution Environment
# Minimal, isolated Linux environment for compiling and running C programs.

FROM alpine:3.20

# Install GCC compiler and musl standard C library headers
RUN apk add --no-cache gcc musl-dev

# Create a dedicated unprivileged user and group for running untrusted code
RUN addgroup -g 1000 prayog && \
    adduser -u 1000 -G prayog -s /bin/sh -D prayog

# Create workspace directory with non-root ownership
WORKDIR /workspace
RUN chown prayog:prayog /workspace

# Default to unprivileged user
USER prayog

# Default check
CMD ["gcc", "--version"]

