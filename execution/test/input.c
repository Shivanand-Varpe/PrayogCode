#include <stdio.h>

int main(void) {
    int a, b;
    printf("Enter two numbers: ");
    fflush(stdout);

    if (scanf("%d %d", &a, &b) == 2) {
        printf("Sum = %d\n", a + b);
    } else {
        printf("Invalid input.\n");
        return 1;
    }

    return 0;
}

