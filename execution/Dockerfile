# PrayogCode C Execution Environment
# Minimal, isolated Linux environment for compiling and running C programs.

FROM alpine:3.20

# Install GCC compiler and musl standard C library headers
RUN apk add --no-cache gcc musl-dev

# Pre-install unbuffered stdio constructor header for interactive terminal I/O
RUN mkdir -p /etc/prayog && \
    printf '#include <stdio.h>\nvoid __attribute__((constructor)) __init_unbuffered(void) {\n    setvbuf(stdout, NULL, _IONBF, 0);\n    setvbuf(stderr, NULL, _IONBF, 0);\n}\n' > /etc/prayog/init.h && \
    chmod 644 /etc/prayog/init.h

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
