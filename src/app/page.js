import Image from "next/image";
import Link from "next/link";
import { demoCatalogue } from "@/data/demo-catalogue";
import { SiteFooter, SiteHeader } from "@/components/site-shell";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="mobile-home">
          <div className="mobile-welcome">
            <div className="mobile-avatar" aria-hidden="true">
              V
            </div>
            <div>
              <span className="mobile-welcome-label">Welcome to Vistara</span>
              <h1>Your next story starts here.</h1>
            </div>
            <Link
              aria-label="Search the movie catalogue"
              className="mobile-search"
              href="/movies"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <circle cx="10.8" cy="10.8" r="6.8" />
                <path d="m16 16 4.2 4.2" />
              </svg>
            </Link>
          </div>

          <Link
            className="mobile-feature"
            href={`/movies/${demoCatalogue[0].id}`}
          >
            <Image
              alt={`Sample artwork for ${demoCatalogue[0].title}`}
              className="mobile-feature-image"
              fill
              priority
              sizes="100vw"
              src={demoCatalogue[0].backdrop}
            />
            <span className="mobile-feature-shade" />
            <span className="mobile-feature-content">
              <span className="mobile-preview-tag">Preview pick</span>
              <strong>{demoCatalogue[0].title}</strong>
              <span>
                {demoCatalogue[0].year} · {demoCatalogue[0].genre}
              </span>
              <span className="mobile-feature-cta">View details</span>
            </span>
          </Link>

          <section className="mobile-rail-section" aria-label="Featured previews">
            <div className="mobile-rail-heading">
              <h2>Featured previews</h2>
              <Link href="/movies">See all</Link>
            </div>
            <div className="mobile-rail">
              {demoCatalogue.slice(0, 4).map((movie) => (
                <Link
                  className="mobile-portrait-card"
                  href={`/movies/${movie.id}`}
                  key={movie.id}
                >
                  <span className="mobile-portrait-image">
                    <Image
                      alt={`Sample artwork for ${movie.title}`}
                      fill
                      sizes="38vw"
                      src={movie.image}
                    />
                  </span>
                  <strong>{movie.title}</strong>
                  <span>{movie.genre} · Preview</span>
                </Link>
              ))}
            </div>
          </section>

          <section className="mobile-rail-section" aria-label="More movie previews">
            <div className="mobile-rail-heading">
              <h2>Explore the catalogue</h2>
              <Link href="/movies">Browse</Link>
            </div>
            <div className="mobile-rail">
              {demoCatalogue.slice(1).map((movie) => (
                <Link
                  className="mobile-landscape-card"
                  href={`/movies/${movie.id}`}
                  key={movie.id}
                >
                  <span className="mobile-landscape-image">
                    <Image
                      alt={`Sample artwork for ${movie.title}`}
                      fill
                      sizes="72vw"
                      src={movie.backdrop ?? movie.image}
                    />
                  </span>
                  <strong>{movie.title}</strong>
                  <span>{movie.year} · Sample artwork</span>
                </Link>
              ))}
            </div>
          </section>

          <p className="mobile-content-note">
            Sample artwork only. No films are currently available to stream.
          </p>
        </section>

        <div className="desktop-home">
          <section className="hero">
            <Image
              alt=""
              className="hero-image"
              fill
              priority
              sizes="100vw"
              src={demoCatalogue[0].backdrop}
            />
            <div className="hero-content">
              <p className="eyebrow">A better kind of movie night</p>
              <h1>Find your next story.</h1>
              <p className="hero-copy">
                Explore a growing catalogue of films and choose an access pass
                that works for you.
              </p>
              <div className="hero-actions">
                <Link className="button-primary" href="/movies">
                  Explore the catalogue
                </Link>
                <Link className="button-secondary" href="/passes">
                  View access passes
                </Link>
              </div>
            </div>
          </section>

          <section className="section page-wrap">
            <div className="notice" role="note">
              <strong>Preview</strong>
              <span>
                The artwork below comes from the supplied Fliqs template and is
                for layout development only. No production catalogue or playback
                is connected yet; publish only content with verified streaming
                rights.
              </span>
            </div>
            <div className="section-heading" style={{ marginTop: 54 }}>
              <div>
                <p className="eyebrow">Made for movie nights</p>
                <h2>Explore what’s on</h2>
                <p>
                  Sample artwork only — production titles will come from the
                  catalogue.
                </p>
              </div>
              <Link className="text-link" href="/movies">
                Browse all
              </Link>
            </div>
            <div className="movie-grid">
              {demoCatalogue.map((movie) => (
                <Link
                  className="movie-card"
                  href={`/movies/${movie.id}`}
                  key={movie.id}
                >
                  <div className="movie-poster">
                    <Image
                      alt={`Sample artwork for ${movie.title}`}
                      fill
                      sizes="(max-width: 560px) 45vw, (max-width: 850px) 30vw, 220px"
                      src={movie.image}
                    />
                  </div>
                  <h3>{movie.title}</h3>
                  <span className="movie-meta">
                    {movie.year} · {movie.genre} · Preview
                  </span>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
