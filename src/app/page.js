"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import {
  ArrowRight,
  Award,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Code2,
  Compass,
  Hammer,
  Monitor,
  QrCode,
  Sparkles,
  Target,
  Trophy,
  Users,
  Zap,
} from "lucide-react";

const heroSlides = [
  {
    image: "/images/landing/youth-coding.png",
    category: "Digital Youth",
    title: "Build, create and explore technology",
    description:
      "Discover coding, robotics, artificial intelligence and emerging technology.",
  },
  {
    image: "/images/landing/youth-trades.png",
    category: "Skilled Trades",
    title: "Turn curiosity into practical skills",
    description:
      "Experience hands-on learning in real workshop and lab environments.",
  },
  {
    image: "/images/landing/youth-campus.png",
    category: "Future Pathways",
    title: "Discover where your skills can take you",
    description:
      "Connect workshop experiences with future education and career pathways.",
  },
];

const opportunities = [
  {
    icon: Code2,
    title: "Coding and Technology",
    description:
      "Develop digital skills through coding, robotics and technology workshops.",
    className: "opportunity-blue",
  },
  {
    icon: Hammer,
    title: "Trades and Construction",
    description:
      "Explore hands-on activities and discover skilled-trades pathways.",
    className: "opportunity-red",
  },
  {
    icon: Sparkles,
    title: "Design and Creativity",
    description:
      "Turn ideas into projects through design, media and creative workshops.",
    className: "opportunity-purple",
  },
  {
    icon: Users,
    title: "Business and Leadership",
    description:
      "Build teamwork, communication and future leadership skills.",
    className: "opportunity-gold",
  },
];

export default function HomePage() {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const sliderInterval = setInterval(() => {
      setCurrentSlide((currentValue) =>
        currentValue === heroSlides.length - 1
          ? 0
          : currentValue + 1
      );
    }, 5500);

    return () => clearInterval(sliderInterval);
  }, []);

  const showPreviousSlide = () => {
    setCurrentSlide((currentValue) =>
      currentValue === 0
        ? heroSlides.length - 1
        : currentValue - 1
    );
  };

  const showNextSlide = () => {
    setCurrentSlide((currentValue) =>
      currentValue === heroSlides.length - 1
        ? 0
        : currentValue + 1
    );
  };

  return (
    <main className="landing-page">
      <header className="landing-header">
        <div className="site-container landing-header-content">
          <Link href="/" className="official-brand">
            <Image
              src="/images/landing/sait-logo.jpg"
              alt="SAIT"
              width={132}
              height={48}
              className="official-brand-image"
              priority
            />

            <span className="official-brand-divider" />

            <span className="official-brand-name">
              Youth
              <br />
              Initiative
            </span>
          </Link>

          <nav className="landing-navigation">
            <Link href="#opportunities">Explore</Link>
            <Link href="#journey">How It Works</Link>
            <Link href="#skill-quest">Skill Quest</Link>

            <Link href="/login" className="landing-login-button">
              Login
            </Link>

            <Link
              href="/register"
              className="primary-button landing-register-button"
            >
              Create Account
            </Link>
          </nav>
        </div>
      </header>

      <section className="impressive-hero">
        <div className="hero-glider hero-glider-one" />
        <div className="hero-glider hero-glider-two" />
        <div className="hero-dot-pattern" />

        <div className="site-container impressive-hero-grid">
          <div className="impressive-hero-content">
            <div className="hero-eyebrow hero-reveal-one">
              <Sparkles size={17} />
              SAIT Youth Initiative
            </div>

            <h1 className="hero-reveal-two">
              Learn something new.
              <span> Discover what is possible.</span>
            </h1>

            <p className="hero-reveal-three">
              Explore hands-on workshops, build real-world skills, track your
              learning journey and discover future SAIT pathways connected to
              your interests.
            </p>

            <div className="hero-actions hero-reveal-four">
              <Link href="/register" className="primary-button hero-main-button">
                Start Your Journey
                <ArrowRight size={19} />
              </Link>

              <Link href="/login" className="hero-outline-button">
                Student Login
              </Link>
            </div>

            <div className="hero-benefits hero-reveal-five">
              <div>
                <CheckCircle2 size={17} />
                Parent-supported accounts
              </div>

              <div>
                <CheckCircle2 size={17} />
                Personalized recommendations
              </div>

              <div>
                <CheckCircle2 size={17} />
                Achievements and progress
              </div>
            </div>
          </div>

          <div className="hero-slider-area">
            <div className="hero-image-frame">
              {heroSlides.map((slide, index) => (
                <div
                  key={slide.title}
                  className={`hero-image-slide ${
                    index === currentSlide ? "active" : ""
                  }`}
                >
                  <Image
                    src={slide.image}
                    alt={slide.title}
                    fill
                    sizes="(max-width: 900px) 100vw, 48vw"
                    className="hero-slide-image"
                    priority={index === 0}
                  />

                  <div className="hero-image-overlay" />

                  <div className="hero-slide-content">
                    <span>{slide.category}</span>
                    <h2>{slide.title}</h2>
                    <p>{slide.description}</p>
                  </div>
                </div>
              ))}

              <button
                type="button"
                className="slider-button slider-button-left"
                onClick={showPreviousSlide}
                aria-label="Show previous image"
              >
                <ChevronLeft size={21} />
              </button>

              <button
                type="button"
                className="slider-button slider-button-right"
                onClick={showNextSlide}
                aria-label="Show next image"
              >
                <ChevronRight size={21} />
              </button>

              <div className="slider-indicators">
                {heroSlides.map((slide, index) => (
                  <button
                    key={slide.title}
                    type="button"
                    aria-label={`Show slide ${index + 1}`}
                    className={
                      index === currentSlide ? "active" : ""
                    }
                    onClick={() => setCurrentSlide(index)}
                  />
                ))}
              </div>
            </div>

            <div className="floating-experience-card">
              <div className="floating-experience-icon">
                <CalendarDays size={22} />
              </div>

              <div>
                <span>Upcoming Workshop</span>
                <strong>Introduction to 3D Printing</strong>
                <small>Tuesday · 4:00 PM</small>
              </div>
            </div>

            <div className="floating-reward-card">
              <div className="floating-reward-badge">
                <Award size={23} />
              </div>

              <div>
                <span>Achievement unlocked</span>
                <strong>Tech Explorer</strong>
                <small>+75 bonus XP</small>
              </div>
            </div>

            <div className="hero-catalyst-shape">
              <div />
              <div />
              <div />
            </div>
          </div>
        </div>

        <div className="site-container impact-strip">
          <div>
            <Monitor size={22} />
            <span>
              <strong>Flexible learning</strong>
              Online and in-person workshops
            </span>
          </div>

          <div>
            <Compass size={22} />
            <span>
              <strong>Explore interests</strong>
              Discover new skill areas
            </span>
          </div>

          <div>
            <Trophy size={22} />
            <span>
              <strong>Celebrate progress</strong>
              Earn XP, badges and milestones
            </span>
          </div>

          <div>
            <Target size={22} />
            <span>
              <strong>Plan your future</strong>
              Explore related SAIT programs
            </span>
          </div>
        </div>
      </section>

      <section
        id="opportunities"
        className="landing-content-section opportunities-section"
      >
        <div className="site-container">
          <div className="landing-section-heading">
            <span>Explore your interests</span>
            <h2>There is more than one way to build your future</h2>
            <p>
              Discover workshops across technology, trades, creativity,
              leadership and other skill areas.
            </p>
          </div>

          <div className="opportunity-grid">
            {opportunities.map((opportunity, index) => {
              const Icon = opportunity.icon;

              return (
                <article
                  key={opportunity.title}
                  className={`opportunity-card ${opportunity.className}`}
                  style={{
                    animationDelay: `${index * 0.12}s`,
                  }}
                >
                  <div className="opportunity-card-icon">
                    <Icon size={27} />
                  </div>

                  <h3>{opportunity.title}</h3>
                  <p>{opportunity.description}</p>

                  <Link href="/register">
                    Start exploring
                    <ArrowRight size={16} />
                  </Link>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="journey" className="landing-content-section journey-section">
        <div className="site-container journey-layout">
          <div className="journey-image-area">
            <Image
              src="/images/landing/youth-campus.png"
              alt="Youth exploring learning opportunities"
              fill
              sizes="(max-width: 900px) 100vw, 45vw"
              className="journey-main-image"
            />

            <div className="journey-image-overlay" />

            <div className="journey-image-message">
              <Zap size={25} />
              <div>
                <strong>Every experience counts</strong>
                <span>
                  Build confidence, skills and a clearer future pathway.
                </span>
              </div>
            </div>
          </div>

          <div className="journey-content">
            <span className="section-small-label">Your journey</span>

            <h2>Simple to begin. Rewarding to continue.</h2>

            <p className="journey-introduction">
              The platform guides students from account registration to
              workshop discovery, attendance and career exploration.
            </p>

            <div className="journey-step-list">
              <div className="journey-step-item">
                <span>01</span>

                <div>
                  <h3>Create your student account</h3>
                  <p>
                    Enter your basic details and complete parent-supported
                    account setup.
                  </p>
                </div>
              </div>

              <div className="journey-step-item">
                <span>02</span>

                <div>
                  <h3>Choose your interests</h3>
                  <p>
                    Select learning modes and skill areas to personalize your
                    experience.
                  </p>
                </div>
              </div>

              <div className="journey-step-item">
                <span>03</span>

                <div>
                  <h3>Attend workshops</h3>
                  <p>
                    Register externally, participate and scan an attendance
                    code.
                  </p>
                </div>
              </div>

              <div className="journey-step-item">
                <span>04</span>

                <div>
                  <h3>Build your future pathway</h3>
                  <p>
                    Earn achievements and discover related SAIT education
                    options.
                  </p>
                </div>
              </div>
            </div>

            <Link href="/register" className="primary-button journey-button">
              Begin Your Journey
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      <section
        id="skill-quest"
        className="landing-content-section skill-quest-section"
      >
        <div className="skill-glider skill-glider-one" />
        <div className="skill-glider skill-glider-two" />

        <div className="site-container skill-quest-layout">
          <div className="skill-quest-content">
            <span className="skill-quest-label">
              <Sparkles size={16} />
              SAIT Skill Quest
            </span>

            <h2>Your learning journey should feel exciting.</h2>

            <p>
              Every verified workshop builds your Skill Quest. Earn XP,
              unlock badges, complete personal challenges and see which skill
              areas are becoming your strongest.
            </p>

            <div className="skill-benefit-list">
              <div>
                <Award size={20} />
                Earn meaningful achievement badges
              </div>

              <div>
                <Target size={20} />
                Complete personalized learning challenges
              </div>

              <div>
                <BookOpen size={20} />
                Unlock recommended workshops and pathways
              </div>
            </div>
          </div>

          <div className="skill-quest-dashboard">
            <div className="skill-player-heading">
              <div className="skill-player-avatar">A</div>

              <div>
                <span>Welcome back,</span>
                <strong>Alex!</strong>
              </div>

              <div className="skill-level-pill">Level 3</div>
            </div>

            <div className="skill-level-card">
              <div className="skill-level-top">
                <div>
                  <span>Current rank</span>
                  <strong>Future Creator</strong>
                </div>

                <strong>620 XP</strong>
              </div>

              <div className="skill-progress-track">
                <div className="skill-progress-value" />
              </div>

              <p>180 XP until Innovation Builder</p>
            </div>

            <div className="skill-stat-grid">
              <div>
                <Award size={20} />
                <strong>4</strong>
                <span>Badges</span>
              </div>

              <div>
                <BookOpen size={20} />
                <strong>5</strong>
                <span>Completed</span>
              </div>

              <div>
                <Zap size={20} />
                <strong>3</strong>
                <span>Streak</span>
              </div>
            </div>

            <div className="weekly-challenge-card">
              <div className="weekly-challenge-icon">
                <Target size={23} />
              </div>

              <div>
                <span>Weekly challenge</span>
                <strong>Explore a new skill</strong>
                <p>Register for a workshop in a new category.</p>
              </div>

              <strong className="weekly-reward">+50 XP</strong>
            </div>

            <div className="badge-preview-row">
              <div className="badge-preview-title">
                <strong>Recent badges</strong>
                <span>View all</span>
              </div>

              <div className="badge-preview-icons">
                <div>
                  <Code2 size={22} />
                </div>

                <div>
                  <Hammer size={22} />
                </div>

                <div>
                  <Sparkles size={22} />
                </div>

                <div className="locked-badge">
                  <Award size={22} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-final-cta">
        <div className="site-container landing-final-cta-content">
          <div>
            <span>Your next experience starts here</span>
            <h2>Explore. Learn. Achieve. Discover your future.</h2>
            <p>
              Create your Youth Initiative account and start building your
              personal learning journey.
            </p>
          </div>

          <Link href="/register" className="final-white-button">
            Create Account
            <ArrowRight size={19} />
          </Link>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="site-container landing-footer-grid">
          <div>
            <div className="official-brand footer-brand">
              <Image
                src="/images/landing/sait-logo.jpg"
                alt="SAIT"
                width={132}
                height={48}
                className="official-brand-image footer-brand-image"
              />

              <span className="official-brand-divider" />

              <span className="official-brand-name">
                Youth
                <br />
                Initiative
              </span>
            </div>

            <p>
              Helping youth explore interests, build skills and discover
              future pathways.
            </p>
          </div>

          <div className="footer-link-group">
            <strong>Students</strong>
            <Link href="/register">Create Account</Link>
            <Link href="/login">Student Login</Link>
            <Link href="/forgot-password">Forgot Password</Link>
          </div>

          <div className="footer-link-group">
            <strong>Platform</strong>
            <Link href="#opportunities">Explore</Link>
            <Link href="#journey">How It Works</Link>
            <Link href="#skill-quest">Skill Quest</Link>
          </div>

          <div className="footer-link-group">
            <strong>Administration</strong>
            <Link href="/admin/login">Admin Login</Link>
          </div>
        </div>

        <div className="site-container landing-footer-bottom">
          <span>SAIT Youth Initiative prototype</span>
          <span>Designed for mobile and desktop</span>
        </div>
      </footer>
    </main>
  );
}