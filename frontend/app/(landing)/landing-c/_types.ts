export type LandingCSearchParams = {
  q?: string | string[];
  chip?: string | string[];
};

export type LandingCPageProps = {
  searchParams: Promise<LandingCSearchParams>;
};
