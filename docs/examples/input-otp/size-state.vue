<template>
  <DouInputOtp :length="4" size="lg" model-value="20" />
  <DouInputOtp :length="4" invalid model-value="1234" />
  <DouInputOtp :length="4" disabled model-value="12" />
</template>
