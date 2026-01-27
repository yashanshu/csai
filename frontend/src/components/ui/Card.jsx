const Card = ({ children, className = "" }) => {
  return (
    <section className={`card glass ${className}`.trim()}>
      <div className="card-body gap-6">{children}</div>
    </section>
  );
};

export default Card;
